"""
InvoiceFlow — Data models
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class InvoiceStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    DONE       = "done"
    ERROR      = "error"


class InvoiceType(str, Enum):
    RECEIVED = "received"   # gasto — te la mandan a ti
    ISSUED   = "issued"     # ingreso — tú la emites
    UNKNOWN  = "unknown"


class Invoice(BaseModel):
    """Core invoice record — what Claude extracts + metadata."""
    id: str
    filename: str
    filepath: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    status: InvoiceStatus = InvoiceStatus.PENDING

    # Extracted fields
    invoice_number: Optional[str]  = None
    invoice_date:   Optional[str]  = None   # ISO string, flexible
    due_date:       Optional[str]  = None
    vendor:         Optional[str]  = None   # quien emite
    vendor_tax_id:  Optional[str]  = None   # NIF/CIF
    client:         Optional[str]  = None   # quien recibe
    client_tax_id:  Optional[str]  = None
    concept:        Optional[str]  = None   # descripción breve
    subtotal:       Optional[float]= None
    tax_rate:       Optional[float]= None   # 0.21, 0.10, etc.
    tax_amount:     Optional[float]= None
    total:          Optional[float]= None
    currency:       str             = "EUR"
    invoice_type:   InvoiceType    = InvoiceType.UNKNOWN
    category:       Optional[str]  = None   # "software", "viajes", "material"…
    notes:          Optional[str]  = None
    confidence:     float           = 0.0   # 0-1 extraction confidence

    error_message:  Optional[str]  = None
    sheets_row:     Optional[int]  = None   # row index if exported


class ExtractionResult(BaseModel):
    """What the Claude API returns — strict JSON schema we request."""
    invoice_number: Optional[str]  = None
    invoice_date:   Optional[str]  = None
    due_date:       Optional[str]  = None
    vendor:         Optional[str]  = None
    vendor_tax_id:  Optional[str]  = None
    client:         Optional[str]  = None
    client_tax_id:  Optional[str]  = None
    concept:        Optional[str]  = None
    subtotal:       Optional[float]= None
    tax_rate:       Optional[float]= None
    tax_amount:     Optional[float]= None
    total:          Optional[float]= None
    currency:       str             = "EUR"
    invoice_type:   str             = "unknown"
    category:       Optional[str]  = None
    notes:          Optional[str]  = None
    confidence:     float           = 0.0


class ProcessResponse(BaseModel):
    invoice_id: str
    status: InvoiceStatus
    message: str


class StatsResponse(BaseModel):
    total: int
    done: int
    errors: int
    total_amount_eur: float
    by_category: dict[str, float]
    by_vendor: dict[str, float]
    by_month: dict[str, float]


# ── Ticket (gasto sin factura formal) ─────────────────────────────────────────

class TicketStatus(str, Enum):
    PENDING_INVOICE = "pending_invoice"   # ticket capturado, factura no recibida aún
    INVOICE_SENT    = "invoice_sent"      # email de solicitud enviado
    INVOICE_RECEIVED= "invoice_received"  # la factura llegó y se procesó
    EXPENSE_ONLY    = "expense_only"      # gasto menor, no se solicita factura


class Ticket(BaseModel):
    """Un ticket de gasto capturado desde el móvil."""
    id: str
    user_id: str = "default"
    filename: str
    filepath: str
    captured_at: datetime = Field(default_factory=datetime.now)
    status: TicketStatus = TicketStatus.PENDING_INVOICE

    # Extraído por Claude Vision
    vendor_name:   Optional[str]  = None   # "Restaurante La Mar"
    vendor_address:Optional[str]  = None
    vendor_phone:  Optional[str]  = None
    vendor_nif:    Optional[str]  = None   # si aparece en el ticket
    ticket_date:   Optional[str]  = None
    ticket_number: Optional[str]  = None
    total:         Optional[float]= None
    tax_rate:      Optional[float]= None
    tax_amount:    Optional[float]= None
    subtotal:      Optional[float]= None
    concept:       Optional[str]  = None   # "Comida de trabajo · 3 personas"
    category:      Optional[str]  = None
    confidence:    float           = 0.0

    # Solicitud de factura
    request_email_to:      Optional[str] = None   # email del comercio (si se encuentra)
    request_email_subject: Optional[str] = None
    request_email_body:    Optional[str] = None
    request_sent_at:       Optional[datetime] = None
    linked_invoice_id:     Optional[str] = None   # cuando llega la factura real

    error_message: Optional[str] = None


class TicketExtractionResult(BaseModel):
    """Lo que devuelve Claude al analizar un ticket."""
    vendor_name:    Optional[str]  = None
    vendor_address: Optional[str]  = None
    vendor_phone:   Optional[str]  = None
    vendor_nif:     Optional[str]  = None
    ticket_date:    Optional[str]  = None
    ticket_number:  Optional[str]  = None
    total:          Optional[float]= None
    tax_rate:       Optional[float]= None
    tax_amount:     Optional[float]= None
    subtotal:       Optional[float]= None
    concept:        Optional[str]  = None
    category:       Optional[str]  = None
    confidence:     float           = 0.0
    # Claude también intenta inferir si el NIF es conocido
    vendor_nif_found: bool = False
