"""
InvoiceFlow — Google Sheets export
"""
from __future__ import annotations

from typing import Optional

from .models import Invoice

HEADERS = [
    "ID", "Archivo", "Fecha Factura", "Vencimiento", "Número",
    "Proveedor", "NIF Proveedor", "Cliente", "NIF Cliente",
    "Concepto", "Categoría", "Base Imponible", "IVA %", "Cuota IVA",
    "Total", "Moneda", "Tipo", "Confianza", "Notas", "Subido"
]


def _invoice_to_row(inv: Invoice) -> list:
    tax_pct = f"{inv.tax_rate * 100:.0f}%" if inv.tax_rate else ""
    return [
        inv.id,
        inv.filename,
        inv.invoice_date or "",
        inv.due_date or "",
        inv.invoice_number or "",
        inv.vendor or "",
        inv.vendor_tax_id or "",
        inv.client or "",
        inv.client_tax_id or "",
        inv.concept or "",
        inv.category or "",
        inv.subtotal if inv.subtotal is not None else "",
        tax_pct,
        inv.tax_amount if inv.tax_amount is not None else "",
        inv.total if inv.total is not None else "",
        inv.currency,
        inv.invoice_type.value,
        f"{inv.confidence:.0%}",
        inv.notes or "",
        inv.uploaded_at.strftime("%Y-%m-%d %H:%M"),
    ]


class SheetsExporter:
    def __init__(self, credentials_file: str, spreadsheet_id: str, sheet_name: str = "Facturas"):
        self.credentials_file = credentials_file
        self.spreadsheet_id = spreadsheet_id
        self.sheet_name = sheet_name
        self._sheet = None

    def _get_sheet(self):
        if self._sheet:
            return self._sheet
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]
        creds = Credentials.from_service_account_file(self.credentials_file, scopes=scopes)
        gc = gspread.authorize(creds)
        spreadsheet = gc.open_by_key(self.spreadsheet_id)

        try:
            self._sheet = spreadsheet.worksheet(self.sheet_name)
        except gspread.WorksheetNotFound:
            self._sheet = spreadsheet.add_worksheet(self.sheet_name, rows=1000, cols=len(HEADERS))
            self._sheet.append_row(HEADERS)

        return self._sheet

    def export_invoice(self, inv: Invoice) -> int:
        """Append invoice to sheet. Returns new row index."""
        sheet = self._get_sheet()
        row = _invoice_to_row(inv)
        sheet.append_row(row, value_input_option="USER_ENTERED")
        # Return approximate row number
        return len(sheet.get_all_values())

    def export_batch(self, invoices: list[Invoice]) -> None:
        """Batch append multiple invoices."""
        sheet = self._get_sheet()
        rows = [_invoice_to_row(inv) for inv in invoices]
        sheet.append_rows(rows, value_input_option="USER_ENTERED")

    def ensure_headers(self) -> None:
        sheet = self._get_sheet()
        first = sheet.row_values(1)
        if not first or first[0] != "ID":
            sheet.insert_row(HEADERS, 1)
