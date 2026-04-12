"""
InvoiceFlow — Portal del gestor fiscal

El autónomo genera un share link con:
- Período (trimestre o rango de fechas)
- Qué ve el gestor (facturas, tickets, ambos)
- Caducidad opcional

El gestor accede sin cuenta. Solo lectura. Sin datos de otros usuarios.
"""
from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, date
from typing import Optional

import aiosqlite

from .config import DB_PATH


# ── Schema ─────────────────────────────────────────────────────────────────────

CREATE_SHARES_TABLE = """
CREATE TABLE IF NOT EXISTS share_links (
    token           TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    label           TEXT,
    date_from       TEXT,
    date_to         TEXT,
    include_tickets INTEGER DEFAULT 0,
    include_amounts INTEGER DEFAULT 1,
    expires_at      INTEGER,
    created_at      INTEGER NOT NULL,
    last_accessed   INTEGER,
    access_count    INTEGER DEFAULT 0
);
"""


async def init_shares_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SHARES_TABLE)
        await db.commit()


# ── Token generation ───────────────────────────────────────────────────────────

def generate_token() -> str:
    """
    Generates a URL-safe token.
    32 bytes of randomness → 64 hex chars — unguessable.
    """
    return secrets.token_urlsafe(24)   # 32 chars, URL-safe


# ── CRUD ───────────────────────────────────────────────────────────────────────

async def create_share_link(
    user_id: str,
    label: str             = "",
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    include_tickets: bool  = False,
    include_amounts: bool  = True,
    expires_days: Optional[int] = None,   # None = never expires
) -> dict:
    """Create a share link and return its record."""
    token      = generate_token()
    now        = int(time.time())
    expires_at = now + expires_days * 86400 if expires_days else None

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SHARES_TABLE)
        await db.execute("""
            INSERT INTO share_links
                (token, user_id, label, date_from, date_to,
                 include_tickets, include_amounts, expires_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (token, user_id, label, date_from, date_to,
              int(include_tickets), int(include_amounts),
              expires_at, now))
        await db.commit()

    return await get_share_link(token)


async def get_share_link(token: str) -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SHARES_TABLE)
        async with db.execute(
            "SELECT * FROM share_links WHERE token = ?", (token,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        return None

    cols = ["token","user_id","label","date_from","date_to",
            "include_tickets","include_amounts","expires_at",
            "created_at","last_accessed","access_count"]
    d = dict(zip(cols, row))
    d["include_tickets"] = bool(d["include_tickets"])
    d["include_amounts"] = bool(d["include_amounts"])
    d["expired"]         = bool(d["expires_at"] and d["expires_at"] < int(time.time()))
    return d


async def list_share_links(user_id: str) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SHARES_TABLE)
        async with db.execute(
            "SELECT * FROM share_links WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,)
        ) as cur:
            rows = await cur.fetchall()

    cols = ["token","user_id","label","date_from","date_to",
            "include_tickets","include_amounts","expires_at",
            "created_at","last_accessed","access_count"]
    now = int(time.time())
    result = []
    for row in rows:
        d = dict(zip(cols, row))
        d["include_tickets"] = bool(d["include_tickets"])
        d["include_amounts"] = bool(d["include_amounts"])
        d["expired"]         = bool(d["expires_at"] and d["expires_at"] < now)
        result.append(d)
    return result


async def record_access(token: str) -> None:
    now = int(time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE share_links
            SET last_accessed = ?, access_count = access_count + 1
            WHERE token = ?
        """, (now, token))
        await db.commit()


async def delete_share_link(token: str, user_id: str) -> bool:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "DELETE FROM share_links WHERE token = ? AND user_id = ?",
            (token, user_id)
        )
        await db.commit()
        return cur.rowcount > 0


# ── Data fetching for the portal ───────────────────────────────────────────────

async def get_shared_data(share: dict) -> dict:
    """
    Fetch the invoices (and optionally tickets) visible through a share link.
    Applies date filter and strips amounts if include_amounts=False.
    """
    from .db import list_invoices
    from .ticket_request import list_tickets

    user_id   = share["user_id"]
    date_from = share.get("date_from")
    date_to   = share.get("date_to")

    # Fetch all done invoices for this user
    all_invoices = await list_invoices(user_id=user_id, status="done", limit=10000)

    # Apply date filter
    invoices = _filter_by_date(all_invoices, date_from, date_to, "invoice_date")

    # Strip amounts if gestor should not see them
    if not share["include_amounts"]:
        for inv in invoices:
            inv.subtotal = None
            inv.tax_amount = None
            inv.total = None

    # Tickets (optional)
    tickets = []
    if share["include_tickets"]:
        all_tickets = await list_tickets(user_id=user_id)
        tickets     = _filter_by_date(all_tickets, date_from, date_to, "ticket_date")

    # Compute summary stats
    total_received = sum(
        (inv.total or 0) for inv in invoices
        if inv.invoice_type.value == "received" and inv.total
    )
    total_issued = sum(
        (inv.total or 0) for inv in invoices
        if inv.invoice_type.value == "issued" and inv.total
    )
    total_vat = sum(
        (inv.tax_amount or 0) for inv in invoices
        if inv.invoice_type.value == "received" and inv.tax_amount
    )
    by_category: dict[str, float] = {}
    for inv in invoices:
        if inv.category and inv.total and inv.invoice_type.value == "received":
            by_category[inv.category] = by_category.get(inv.category, 0) + inv.total

    return {
        "invoices":       invoices,
        "tickets":        tickets,
        "total_received": round(total_received, 2),
        "total_issued":   round(total_issued, 2),
        "total_vat":      round(total_vat, 2),
        "invoice_count":  len(invoices),
        "ticket_count":   len(tickets),
        "by_category":    by_category,
    }


def _filter_by_date(items, date_from, date_to, date_field):
    if not date_from and not date_to:
        return items
    result = []
    for item in items:
        d = getattr(item, date_field, None)
        if not d:
            result.append(item)
            continue
        try:
            item_date = d[:10]  # YYYY-MM-DD
            if date_from and item_date < date_from:
                continue
            if date_to and item_date > date_to:
                continue
            result.append(item)
        except Exception:
            result.append(item)
    return result


# ── Quarter helpers ────────────────────────────────────────────────────────────

def current_quarter_dates() -> tuple[str, str]:
    """Returns (date_from, date_to) for the current Spanish fiscal quarter."""
    today = date.today()
    q     = (today.month - 1) // 3 + 1
    starts = {1: (1,1), 2: (4,1), 3: (7,1), 4: (10,1)}
    ends   = {1: (3,31), 2: (6,30), 3: (9,30), 4: (12,31)}
    y = today.year
    return (
        f"{y}-{starts[q][0]:02d}-{starts[q][1]:02d}",
        f"{y}-{ends[q][0]:02d}-{ends[q][1]:02d}",
    )


def quarter_label(date_from: str) -> str:
    """'2025-01-01' → 'Q1 2025'"""
    try:
        d = datetime.strptime(date_from, "%Y-%m-%d")
        q = (d.month - 1) // 3 + 1
        return f"Q{q} {d.year}"
    except Exception:
        return date_from
