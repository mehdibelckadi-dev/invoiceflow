"""
InvoiceFlow — Processing pipeline (multi-user)
"""
from __future__ import annotations

import shutil
import uuid
from datetime import datetime
from pathlib import Path

from .config import PROCESSED_DIR, Settings
from .db import save_invoice
from .extractor import extract_invoice
from .models import Invoice, InvoiceStatus, InvoiceType


async def process_file(
    path: Path,
    settings: Settings,
    user_id: str = "default",
) -> Invoice:
    invoice_id = uuid.uuid4().hex[:12]

    inv = Invoice(
        id=invoice_id,
        filename=path.name,
        filepath=str(path),
        uploaded_at=datetime.now(),
        status=InvoiceStatus.PROCESSING,
    )
    await save_invoice(inv, user_id=user_id)

    try:
        if not settings.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY no configurada.")

        result = await extract_invoice(
            path=path,
            api_key=settings.anthropic_api_key,
            model=settings.claude_model,
            my_company=settings.my_company_name,
            my_tax_id=settings.my_tax_id,
        )

        inv.status         = InvoiceStatus.DONE
        inv.invoice_number = result.invoice_number
        inv.invoice_date   = result.invoice_date
        inv.due_date       = result.due_date
        inv.vendor         = result.vendor
        inv.vendor_tax_id  = result.vendor_tax_id
        inv.client         = result.client
        inv.client_tax_id  = result.client_tax_id
        inv.concept        = result.concept
        inv.subtotal       = result.subtotal
        inv.tax_rate       = result.tax_rate
        inv.tax_amount     = result.tax_amount
        inv.total          = result.total
        inv.currency       = result.currency or "EUR"
        inv.invoice_type   = InvoiceType(result.invoice_type or "unknown")
        inv.category       = result.category
        inv.notes          = result.notes
        inv.confidence     = result.confidence

        # Google Sheets (Pro plan only — checked by caller)
        if settings.google_credentials_file and settings.spreadsheet_id:
            try:
                from .sheets import SheetsExporter
                exporter = SheetsExporter(
                    settings.google_credentials_file,
                    settings.spreadsheet_id,
                    settings.sheet_name,
                )
                inv.sheets_row = exporter.export_invoice(inv)
            except Exception as e:
                inv.notes = (inv.notes or "") + f" [Sheets: {e}]"

        # Archive processed file
        dest = PROCESSED_DIR / f"{user_id}_{invoice_id}_{path.name}"
        shutil.copy2(str(path), str(dest))
        inv.filepath = str(dest)

    except Exception as exc:
        inv.status        = InvoiceStatus.ERROR
        inv.error_message = str(exc)

    await save_invoice(inv, user_id=user_id)
    return inv
