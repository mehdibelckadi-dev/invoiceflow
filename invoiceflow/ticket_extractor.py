"""
InvoiceFlow — Ticket extractor
Especializado en tickets físicos de comercios, restaurantes, taxis, etc.
Diferente del extractor de facturas: aquí el documento es informal,
puede estar girado, mal iluminado, o tener datos incompletos.
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Optional

from .models import TicketExtractionResult

# ── Image loading ──────────────────────────────────────────────────────────────

def image_to_b64(path: Path, max_size: int = 1200) -> Optional[tuple[str, str]]:
    """
    Load and optionally resize image. Returns (base64, media_type) or None.
    Resizes to max_size px on longest side to keep API costs low.
    """
    try:
        from PIL import Image
        import io

        img = Image.open(path)

        # Auto-rotate based on EXIF (mobile photos are often rotated)
        try:
            from PIL import ImageOps
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Resize if too large
        w, h = img.size
        if max(w, h) > max_size:
            ratio = max_size / max(w, h)
            img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        # Convert to RGB (handles HEIC, RGBA, etc.)
        if img.mode != "RGB":
            img = img.convert("RGB")

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=88)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return b64, "image/jpeg"

    except ImportError:
        # Fallback: read raw bytes
        data = path.read_bytes()
        ext  = path.suffix.lower()
        mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png",  "webp": "image/webp"}.get(ext.lstrip("."), "image/jpeg")
        return base64.b64encode(data).decode(), mime
    except Exception:
        return None


# ── Prompt ─────────────────────────────────────────────────────────────────────

TICKET_SYSTEM = """Eres un experto en leer tickets y recibos de comercios españoles.
Tu tarea es extraer datos de tickets físicos fotografiados: restaurantes, taxis, supermercados,
gasolineras, parkings, etc.

Los tickets pueden estar:
- Girados o en ángulo
- Mal iluminados o con bajo contraste
- Parcialmente ilegibles
- En papel térmico (texto gris sobre blanco)

Extrae lo que puedas con máxima precisión. Responde SOLO con JSON válido, sin preamble ni markdown.
Si un campo no es legible, usa null. Nunca inventes datos.

El campo "confidence" refleja tu confianza general de 0.0 a 1.0.
El campo "vendor_nif_found" es true solo si has visto explícitamente un NIF/CIF en el ticket.
Para "category" usa: restauracion, transporte, alojamiento, material_oficina, 
combustible, parking, formacion, otros.
"""

TICKET_SCHEMA = """{
  "vendor_name": "nombre del comercio o null",
  "vendor_address": "dirección completa o null",
  "vendor_phone": "teléfono o null",
  "vendor_nif": "NIF o CIF del comercio o null",
  "ticket_date": "YYYY-MM-DD o null",
  "ticket_number": "número de ticket/recibo o null",
  "total": importe_total_número_o_null,
  "tax_rate": decimal_tipo_iva_o_null,
  "tax_amount": importe_iva_número_o_null,
  "subtotal": base_imponible_número_o_null,
  "concept": "descripción breve de qué es (ej: Comida trabajo 3 personas) o null",
  "category": "categoria_string",
  "confidence": 0.0_a_1.0,
  "vendor_nif_found": true_o_false
}"""


# ── Main extraction function ───────────────────────────────────────────────────

async def extract_ticket(
    path: Path,
    api_key: str,
    model: str,
    my_company: str = "",
    my_tax_id: str  = "",
) -> TicketExtractionResult:
    """
    Extract data from a physical ticket photo using Claude Vision.
    """
    import anthropic

    img_data = image_to_b64(path)
    if not img_data:
        return TicketExtractionResult(confidence=0.0)

    b64, mime_type = img_data

    context = ""
    if my_company:
        context += f"\nNombre de mi empresa: {my_company}"
    if my_tax_id:
        context += f"\nMi NIF: {my_tax_id}"

    user_content = [
        {
            "type": "image",
            "source": {"type": "base64", "media_type": mime_type, "data": b64},
        },
        {
            "type": "text",
            "text": f"""Analiza este ticket o recibo y extrae todos los datos visibles.{context}

Devuelve SOLO este JSON:
{TICKET_SCHEMA}""",
        },
    ]

    client   = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        max_tokens=800,
        system=TICKET_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
    )

    raw = response.content[0].text if response.content else "{}"
    raw = re.sub(r"```json\s*|\s*```", "", raw).strip()

    try:
        data = json.loads(raw)
        return TicketExtractionResult(**data)
    except Exception as exc:
        return TicketExtractionResult(
            confidence=0.0,
            concept=f"Error de parseo: {exc}",
        )
