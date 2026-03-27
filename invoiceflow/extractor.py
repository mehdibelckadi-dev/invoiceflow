"""
InvoiceFlow — Claude-powered invoice extractor
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Optional

from .models import ExtractionResult

# PDF text extraction (PyMuPDF)
try:
    import fitz
    _PYMUPDF = True
except ImportError:
    _PYMUPDF = False

# Image conversion (Pillow)
try:
    from PIL import Image
    import io
    _PIL = True
except ImportError:
    _PIL = False


# ── PDF → text + images ────────────────────────────────────────────────────────

def extract_pdf_text(path: Path, max_chars: int = 6000) -> str:
    if not _PYMUPDF:
        return ""
    try:
        doc = fitz.open(str(path))
        pages = []
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return "\n".join(pages)[:max_chars]
    except Exception:
        return ""


def pdf_to_image_b64(path: Path, page: int = 0, dpi: int = 150) -> Optional[str]:
    """Render first page of PDF as base64 JPEG for vision fallback."""
    if not _PYMUPDF or not _PIL:
        return None
    try:
        doc = fitz.open(str(path))
        if doc.page_count == 0:
            return None
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = doc[page].get_pixmap(matrix=mat)
        doc.close()
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def image_to_b64(path: Path) -> Optional[str]:
    if not _PIL:
        return None
    try:
        with Image.open(path) as img:
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="JPEG", quality=85)
            return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


# ── Prompt ─────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert invoice data extractor. 
Your job is to read invoice documents (PDFs, images, text) and return structured JSON data.
Always respond with ONLY a valid JSON object — no preamble, no markdown, no explanation.
Be precise with numbers. Use null for missing fields, never guess critical data like totals.
Dates should be ISO format (YYYY-MM-DD) when possible.
tax_rate should be a decimal (0.21 for 21%, not 21).
For invoice_type: "received" means you are the buyer/client, "issued" means you are the seller.
For category use common Spanish accounting categories: software, viajes, material_oficina, 
servicios_profesionales, publicidad, formacion, hosting, telefonia, otros.
confidence is your overall extraction confidence from 0.0 to 1.0.
"""

EXTRACTION_SCHEMA = """{
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "vendor": "company/person name or null",
  "vendor_tax_id": "NIF/CIF/VAT or null",
  "client": "company/person name or null",
  "client_tax_id": "NIF/CIF/VAT or null",
  "concept": "brief description of what was purchased or null",
  "subtotal": number_or_null,
  "tax_rate": decimal_or_null,
  "tax_amount": number_or_null,
  "total": number_or_null,
  "currency": "EUR",
  "invoice_type": "received|issued|unknown",
  "category": "category_string or null",
  "notes": "any relevant notes or null",
  "confidence": 0.0_to_1.0
}"""


def build_user_message(
    text: str,
    image_b64: Optional[str],
    filename: str,
    my_company: str = "",
    my_tax_id: str = "",
) -> list[dict]:
    context = ""
    if my_company:
        context += f"\nMy company name: {my_company}"
    if my_tax_id:
        context += f"\nMy tax ID: {my_tax_id}"

    prompt = f"""Extract all invoice data from this document.
Filename: {filename}{context}

Return ONLY this JSON structure:
{EXTRACTION_SCHEMA}
"""
    content: list[dict] = []

    if image_b64:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": image_b64,
            }
        })

    if text.strip():
        content.append({
            "type": "text",
            "text": f"Document text content:\n{text}\n\n{prompt}",
        })
    else:
        content.append({"type": "text", "text": prompt})

    return content


# ── Main extractor ─────────────────────────────────────────────────────────────

async def extract_invoice(
    path: Path,
    api_key: str,
    model: str,
    my_company: str = "",
    my_tax_id: str = "",
) -> ExtractionResult:
    """
    Send invoice to Claude and parse the structured response.
    Supports PDF (text + vision) and images.
    """
    import anthropic

    suffix = path.suffix.lower()
    text = ""
    image_b64: Optional[str] = None

    if suffix == ".pdf":
        text = extract_pdf_text(path)
        # Use vision if text is thin (scanned PDF)
        if len(text.strip()) < 100:
            image_b64 = pdf_to_image_b64(path)
        else:
            # Still send image for layout context
            image_b64 = pdf_to_image_b64(path)
    elif suffix in {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"}:
        image_b64 = image_to_b64(path)
    else:
        # Plain text fallback
        try:
            text = path.read_text(errors="replace")[:6000]
        except Exception:
            text = ""

    content = build_user_message(text, image_b64, path.name, my_company, my_tax_id)

    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    raw = response.content[0].text if response.content else "{}"

    # Strip markdown fences if Claude adds them despite instructions
    raw = re.sub(r"```json\s*|\s*```", "", raw).strip()

    try:
        data = json.loads(raw)
        return ExtractionResult(**data)
    except Exception as exc:
        # Partial extraction — return what we can parse
        return ExtractionResult(
            notes=f"Parse error: {exc} | raw: {raw[:200]}",
            confidence=0.0,
        )
