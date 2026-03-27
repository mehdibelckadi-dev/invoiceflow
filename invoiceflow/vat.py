"""
InvoiceFlow — Motor de cálculo de IVA
Modelo 303 español — declaración trimestral

Estructura del 303:
  [IVA repercutido]  = IVA cobrado en tus facturas EMITIDAS
  [IVA soportado]    = IVA pagado en tus facturas RECIBIDAS (deducible)
  [Resultado]        = Repercutido − Soportado
                       > 0 → pagas a Hacienda
                       < 0 → te devuelven (o compensas)

Plazos de presentación:
  Q1 (ene–mar) → hasta el 20 de abril
  Q2 (abr–jun) → hasta el 20 de julio
  Q3 (jul–sep) → hasta el 20 de octubre
  Q4 (oct–dic) → hasta el 30 de enero del año siguiente
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

from .models import Invoice, InvoiceType


# ── Quarter helpers ────────────────────────────────────────────────────────────

@dataclass
class Quarter:
    year: int
    q: int        # 1–4

    @property
    def label(self) -> str:
        return f"Q{self.q} {self.year}"

    @property
    def date_from(self) -> date:
        month = (self.q - 1) * 3 + 1
        return date(self.year, month, 1)

    @property
    def date_to(self) -> date:
        end_month = self.q * 3
        # Last day of end_month
        if end_month == 12:
            return date(self.year, 12, 31)
        return date(self.year, end_month + 1, 1) - timedelta(days=1)

    @property
    def deadline(self) -> date:
        """Deadline to file modelo 303 for this quarter."""
        deadlines = {1: (4, 20), 2: (7, 20), 3: (10, 20), 4: (1, 30)}
        m, d = deadlines[self.q]
        y    = self.year + 1 if self.q == 4 else self.year
        return date(y, m, d)

    @property
    def days_until_deadline(self) -> int:
        return (self.deadline - date.today()).days

    @property
    def is_past(self) -> bool:
        return date.today() > self.date_to

    @property
    def is_current(self) -> bool:
        return self.date_from <= date.today() <= self.date_to

    @property
    def str_from(self) -> str:
        return self.date_from.strftime("%Y-%m-%d")

    @property
    def str_to(self) -> str:
        return self.date_to.strftime("%Y-%m-%d")


def current_quarter() -> Quarter:
    today = date.today()
    return Quarter(today.year, (today.month - 1) // 3 + 1)


def all_quarters_for_year(year: int) -> list[Quarter]:
    return [Quarter(year, q) for q in range(1, 5)]


def quarter_for_date(d: str) -> Optional[Quarter]:
    """Given 'YYYY-MM-DD', return the Quarter it belongs to."""
    try:
        dt = datetime.strptime(d[:10], "%Y-%m-%d").date()
        return Quarter(dt.year, (dt.month - 1) // 3 + 1)
    except Exception:
        return None


# ── VAT summary per quarter ────────────────────────────────────────────────────

@dataclass
class VATLine:
    """One line in the 303 — base + rate + quota."""
    tax_rate:   float        # 0.21, 0.10, 0.04
    base:       float = 0.0
    quota:      float = 0.0  # base × tax_rate
    count:      int   = 0    # number of invoices


@dataclass
class QuarterVAT:
    quarter:     Quarter
    invoices:    list[Invoice] = field(default_factory=list)

    # Modelo 303 boxes
    # [Devengado — IVA repercutido] (tus ventas)
    issued_lines:   list[VATLine] = field(default_factory=list)
    # [Deducible — IVA soportado] (tus compras)
    received_lines: list[VATLine] = field(default_factory=list)

    @property
    def total_base_issued(self) -> float:
        return round(sum(l.base for l in self.issued_lines), 2)

    @property
    def total_vat_issued(self) -> float:
        """IVA repercutido — lo que has cobrado."""
        return round(sum(l.quota for l in self.issued_lines), 2)

    @property
    def total_base_received(self) -> float:
        return round(sum(l.base for l in self.received_lines), 2)

    @property
    def total_vat_received(self) -> float:
        """IVA soportado deducible — lo que has pagado."""
        return round(sum(l.quota for l in self.received_lines), 2)

    @property
    def resultado(self) -> float:
        """Resultado 303 = Repercutido − Soportado."""
        return round(self.total_vat_issued - self.total_vat_received, 2)

    @property
    def resultado_label(self) -> str:
        r = self.resultado
        if r > 0:   return "A ingresar"
        if r < 0:   return "A compensar"
        return "Resultado cero"

    @property
    def resultado_color(self) -> str:
        r = self.resultado
        if r > 0:  return "red"
        if r < 0:  return "green"
        return "muted"

    @property
    def invoice_count(self) -> int:
        return len(self.invoices)

    @property
    def missing_vat_count(self) -> int:
        """Invoices without VAT data — need review."""
        return sum(1 for inv in self.invoices
                   if inv.tax_amount is None and inv.total is not None)

    @property
    def confidence_avg(self) -> float:
        if not self.invoices:
            return 0.0
        return sum(inv.confidence for inv in self.invoices) / len(self.invoices)


# ── Engine ─────────────────────────────────────────────────────────────────────

def compute_quarter_vat(
    invoices: list[Invoice],
    quarter:  Quarter,
) -> QuarterVAT:
    """
    Compute VAT summary for a quarter from a list of invoices.
    Filters by invoice_date within the quarter range.
    Groups by tax rate (21%, 10%, 4%).
    """
    result = QuarterVAT(quarter=quarter)

    # Filter to this quarter
    q_invoices = [
        inv for inv in invoices
        if _in_quarter(inv.invoice_date, quarter)
    ]
    result.invoices = q_invoices

    # Group by type × tax_rate
    issued_map:   dict[float, VATLine] = {}
    received_map: dict[float, VATLine] = {}

    for inv in q_invoices:
        if inv.invoice_type == InvoiceType.UNKNOWN:
            continue

        rate  = inv.tax_rate or 0.0
        base  = inv.subtotal or 0.0
        quota = inv.tax_amount or (base * rate if rate else 0.0)

        target = issued_map if inv.invoice_type == InvoiceType.ISSUED else received_map

        if rate not in target:
            target[rate] = VATLine(tax_rate=rate)
        target[rate].base  += base
        target[rate].quota += quota
        target[rate].count += 1

    # Sort by rate descending (21% first)
    result.issued_lines   = sorted(issued_map.values(),   key=lambda l: -l.tax_rate)
    result.received_lines = sorted(received_map.values(), key=lambda l: -l.tax_rate)

    # Round all
    for line in result.issued_lines + result.received_lines:
        line.base  = round(line.base,  2)
        line.quota = round(line.quota, 2)

    return result


def compute_year_summary(
    invoices: list[Invoice],
    year:     int,
) -> list[QuarterVAT]:
    """Compute VAT for all 4 quarters of a year."""
    return [
        compute_quarter_vat(invoices, Quarter(year, q))
        for q in range(1, 5)
    ]


def _in_quarter(invoice_date: Optional[str], quarter: Quarter) -> bool:
    if not invoice_date:
        return False
    try:
        d = datetime.strptime(invoice_date[:10], "%Y-%m-%d").date()
        return quarter.date_from <= d <= quarter.date_to
    except Exception:
        return False


# ── CSV export (Holded / Contasol compatible) ──────────────────────────────────

def invoices_to_holded_csv(invoices: list[Invoice]) -> str:
    """
    Export in Holded import format.
    Columns: Fecha, Nº Doc, Proveedor/Cliente, NIF, Concepto,
             Base 21%, Cuota 21%, Base 10%, Cuota 10%, Base 4%, Cuota 4%,
             Total, Tipo (G=gasto/I=ingreso)
    """
    import csv, io
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")

    writer.writerow([
        "Fecha","Nº Documento","Proveedor/Cliente","NIF","Concepto",
        "Base 21%","Cuota 21%","Base 10%","Cuota 10%","Base 4%","Cuota 4%",
        "Total","Tipo"
    ])

    for inv in invoices:
        rate = inv.tax_rate or 0.0
        b21 = b10 = b4 = ""
        q21 = q10 = q4 = ""

        if abs(rate - 0.21) < 0.01:
            b21 = _fmt(inv.subtotal);   q21 = _fmt(inv.tax_amount)
        elif abs(rate - 0.10) < 0.01:
            b10 = _fmt(inv.subtotal);   q10 = _fmt(inv.tax_amount)
        elif abs(rate - 0.04) < 0.01:
            b4  = _fmt(inv.subtotal);   q4  = _fmt(inv.tax_amount)

        tipo = "G" if inv.invoice_type == InvoiceType.RECEIVED else "I"
        party = inv.vendor if inv.invoice_type == InvoiceType.RECEIVED else inv.client

        writer.writerow([
            inv.invoice_date   or "",
            inv.invoice_number or "",
            party              or "",
            inv.vendor_tax_id  or inv.client_tax_id or "",
            inv.concept        or "",
            b21, q21, b10, q10, b4, q4,
            _fmt(inv.total),
            tipo,
        ])

    output.seek(0)
    return output.read()


def _fmt(v: Optional[float]) -> str:
    if v is None:
        return ""
    return str(v).replace(".", ",")   # Spanish decimal separator
