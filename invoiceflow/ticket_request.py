"""
InvoiceFlow — Generador de solicitud de factura

Dado un ticket extraído, genera un email formal solicitando
la factura al comercio, con:
- Referencia al RD 1619/2012 (obligación de emitir factura)
- Datos del ticket (fecha, importe, concepto)
- Datos del solicitante (nombre, NIF)
- Tono profesional pero directo

También intenta buscar el email del comercio por nombre + localidad.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from .models import Ticket


# ── Email generation ───────────────────────────────────────────────────────────

@dataclass
class InvoiceRequestEmail:
    to: Optional[str]         # email del comercio (puede ser None)
    subject: str
    body: str
    found_contact: bool       # True si encontramos el email automáticamente


def generate_request_email(
    ticket: Ticket,
    my_name: str,
    my_tax_id: str,
    my_address: str = "",
    my_email: str   = "",
) -> InvoiceRequestEmail:
    """
    Genera el email formal de solicitud de factura.
    Listo para enviar o para que el usuario copie y envíe manualmente.
    """
    vendor    = ticket.vendor_name or "establecimiento"
    date_str  = ticket.ticket_date or "la fecha indicada en el ticket"
    amount    = f"{ticket.total:.2f} €" if ticket.total else "el importe del ticket"
    concept   = ticket.concept or "los servicios/productos adquiridos"
    ticket_no = f" (nº {ticket.ticket_number})" if ticket.ticket_number else ""

    subject = f"Solicitud de factura — {date_str} — {amount}"

    # Saludo adaptado: si tenemos el nombre del comercio, lo usamos
    greeting = f"Estimados Sres. de {vendor}," if vendor != "establecimiento" \
               else "Estimados señores,"

    address_block = f"\n{my_address}" if my_address else ""
    email_block   = f"\nEmail: {my_email}" if my_email else ""

    body = f"""{greeting}

Me pongo en contacto con ustedes para solicitar la correspondiente factura del \
ticket{ticket_no} emitido el {date_str} por importe de {amount}, correspondiente a {concept}.

De acuerdo con el artículo 2 del Real Decreto 1619/2012, de 30 de noviembre, \
por el que se aprueba el Reglamento por el que se regulan las obligaciones de \
facturación, los empresarios y profesionales están obligados a expedir factura \
por las operaciones que realicen.

Mis datos para la emisión de la factura son:

  Nombre / Razón social: {my_name}
  NIF: {my_tax_id}{address_block}{email_block}

Les agradezco que me remitan la factura a la mayor brevedad posible \
a la dirección de correo indicada.

Quedando a su disposición para cualquier consulta,

Atentamente,
{my_name}
NIF: {my_tax_id}
"""

    return InvoiceRequestEmail(
        to=ticket.request_email_to,
        subject=subject,
        body=body.strip(),
        found_contact=bool(ticket.request_email_to),
    )


# ── NIF lookup helpers ─────────────────────────────────────────────────────────

def clean_nif(raw: Optional[str]) -> Optional[str]:
    """Normaliza un NIF/CIF español."""
    if not raw:
        return None
    nif = re.sub(r"[^A-Z0-9]", "", raw.upper())
    # Spanish NIF: 8 digits + letter, or CIF: letter + 7 digits + digit/letter
    if re.match(r"^[0-9]{8}[A-Z]$", nif):
        return nif
    if re.match(r"^[A-Z][0-9]{7}[0-9A-J]$", nif):
        return nif
    return nif if len(nif) >= 8 else None


async def lookup_vendor_email(
    vendor_name: str,
    vendor_address: Optional[str] = None,
) -> Optional[str]:
    """
    Intenta encontrar el email de contacto de un comercio.
    Estrategia:
    1. Google Maps / Places API (si está configurado)
    2. Búsqueda web simple por nombre + localidad

    En esta versión devuelve None — el usuario introduce el email manualmente.
    En una versión futura se puede integrar con Google Places API.
    """
    # Placeholder — implementar con Google Places API si se quiere automatizar
    # Por ahora el flujo es: usuario ve el email generado y añade el destinatario
    return None


# ── Send via SMTP / Resend ─────────────────────────────────────────────────────

async def send_request_email(
    email: InvoiceRequestEmail,
    smtp_host: str = "",
    smtp_port: int = 587,
    smtp_user: str = "",
    smtp_pass: str = "",
    from_email: str = "",
    resend_api_key: str = "",
) -> bool:
    """
    Envía el email de solicitud.
    Soporta: Resend API (recomendado) o SMTP genérico.
    Devuelve True si el envío fue exitoso.
    """
    if not email.to:
        return False

    # ── Resend (preferido — más simple, mejor deliverability) ─────────────────
    if resend_api_key:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from":    from_email or "facturas@invoiceflow.es",
                        "to":      [email.to],
                        "subject": email.subject,
                        "text":    email.body,
                    },
                )
                return resp.status_code == 200
        except Exception:
            return False

    # ── SMTP fallback ──────────────────────────────────────────────────────────
    if smtp_host and smtp_user:
        try:
            import smtplib
            from email.mime.text import MIMEText

            msg = MIMEText(email.body, "plain", "utf-8")
            msg["Subject"] = email.subject
            msg["From"]    = from_email or smtp_user
            msg["To"]      = email.to

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            return True
        except Exception:
            return False

    return False


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def save_ticket(ticket: Ticket) -> None:
    """Persist ticket to SQLite."""
    import json
    from datetime import datetime
    import aiosqlite
    from .config import DB_PATH

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'default',
                filename TEXT, filepath TEXT, captured_at TEXT,
                status TEXT DEFAULT 'pending_invoice',
                vendor_name TEXT, vendor_address TEXT, vendor_phone TEXT,
                vendor_nif TEXT, ticket_date TEXT, ticket_number TEXT,
                total REAL, tax_rate REAL, tax_amount REAL, subtotal REAL,
                concept TEXT, category TEXT, confidence REAL DEFAULT 0,
                request_email_to TEXT, request_email_subject TEXT,
                request_email_body TEXT, request_sent_at TEXT,
                linked_invoice_id TEXT, error_message TEXT
            )
        """)
        d = ticket.model_dump()
        d["captured_at"]      = ticket.captured_at.isoformat()
        d["request_sent_at"]  = ticket.request_sent_at.isoformat() \
                                if ticket.request_sent_at else None
        d["status"]           = ticket.status.value
        await db.execute("""
            INSERT OR REPLACE INTO tickets VALUES (
                :id,:user_id,:filename,:filepath,:captured_at,:status,
                :vendor_name,:vendor_address,:vendor_phone,:vendor_nif,
                :ticket_date,:ticket_number,:total,:tax_rate,:tax_amount,
                :subtotal,:concept,:category,:confidence,
                :request_email_to,:request_email_subject,:request_email_body,
                :request_sent_at,:linked_invoice_id,:error_message
            )
        """, d)
        await db.commit()


async def list_tickets(
    user_id: str = "default",
    status: Optional[str] = None,
    limit: int = 100,
) -> list[Ticket]:
    import aiosqlite
    from .config import DB_PATH
    from datetime import datetime

    async with aiosqlite.connect(DB_PATH) as db:
        # Ensure table exists
        await db.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'default',
                filename TEXT, filepath TEXT, captured_at TEXT,
                status TEXT DEFAULT 'pending_invoice',
                vendor_name TEXT, vendor_address TEXT, vendor_phone TEXT,
                vendor_nif TEXT, ticket_date TEXT, ticket_number TEXT,
                total REAL, tax_rate REAL, tax_amount REAL, subtotal REAL,
                concept TEXT, category TEXT, confidence REAL DEFAULT 0,
                request_email_to TEXT, request_email_subject TEXT,
                request_email_body TEXT, request_sent_at TEXT,
                linked_invoice_id TEXT, error_message TEXT
            )
        """)
        if status:
            sql    = "SELECT * FROM tickets WHERE user_id=? AND status=? ORDER BY captured_at DESC LIMIT ?"
            params = (user_id, status, limit)
        else:
            sql    = "SELECT * FROM tickets WHERE user_id=? ORDER BY captured_at DESC LIMIT ?"
            params = (user_id, limit)

        cols = [
            "id","user_id","filename","filepath","captured_at","status",
            "vendor_name","vendor_address","vendor_phone","vendor_nif",
            "ticket_date","ticket_number","total","tax_rate","tax_amount",
            "subtotal","concept","category","confidence",
            "request_email_to","request_email_subject","request_email_body",
            "request_sent_at","linked_invoice_id","error_message",
        ]
        async with db.execute(sql, params) as cur:
            rows = await cur.fetchall()

        tickets = []
        for row in rows:
            d = dict(zip(cols, row))
            d["captured_at"]     = datetime.fromisoformat(d["captured_at"]) \
                                   if d["captured_at"] else datetime.now()
            d["request_sent_at"] = datetime.fromisoformat(d["request_sent_at"]) \
                                   if d["request_sent_at"] else None
            d.pop("user_id", None)
            tickets.append(Ticket(**d))
        return tickets
