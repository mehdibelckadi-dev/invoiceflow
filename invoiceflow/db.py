"""
InvoiceFlow — SQLite persistence (multi-user)
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

import aiosqlite

from .config import DB_PATH
from .models import Invoice, InvoiceStatus, InvoiceType

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS invoices (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL DEFAULT 'default',
    filename        TEXT NOT NULL,
    filepath        TEXT NOT NULL,
    uploaded_at     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    invoice_number  TEXT,
    invoice_date    TEXT,
    due_date        TEXT,
    vendor          TEXT,
    vendor_tax_id   TEXT,
    client          TEXT,
    client_tax_id   TEXT,
    concept         TEXT,
    subtotal        REAL,
    tax_rate        REAL,
    tax_amount      REAL,
    total           REAL,
    currency        TEXT DEFAULT 'EUR',
    invoice_type    TEXT DEFAULT 'unknown',
    category        TEXT,
    notes           TEXT,
    confidence      REAL DEFAULT 0.0,
    error_message   TEXT,
    sheets_row      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(user_id, status);
"""


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in CREATE_TABLE.strip().split(";"):
            if stmt.strip():
                await db.execute(stmt)
        # Migration: add user_id column if upgrading from v1
        try:
            await db.execute("ALTER TABLE invoices ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'")
        except Exception:
            pass
        await db.commit()


def _row_to_invoice(row) -> Invoice:
    keys = [
        "id","user_id","filename","filepath","uploaded_at","status",
        "invoice_number","invoice_date","due_date","vendor","vendor_tax_id",
        "client","client_tax_id","concept","subtotal","tax_rate","tax_amount",
        "total","currency","invoice_type","category","notes","confidence",
        "error_message","sheets_row",
    ]
    d = dict(zip(keys, row))
    d["uploaded_at"] = datetime.fromisoformat(d["uploaded_at"])
    d.pop("user_id", None)   # not in Invoice model
    return Invoice(**d)


async def save_invoice(inv: Invoice, user_id: str = "default") -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT OR REPLACE INTO invoices VALUES (
                :id,:user_id,:filename,:filepath,:uploaded_at,:status,
                :invoice_number,:invoice_date,:due_date,:vendor,:vendor_tax_id,
                :client,:client_tax_id,:concept,:subtotal,:tax_rate,:tax_amount,
                :total,:currency,:invoice_type,:category,:notes,:confidence,
                :error_message,:sheets_row
            )
        """, {
            **inv.model_dump(),
            "user_id":      user_id,
            "uploaded_at":  inv.uploaded_at.isoformat(),
            "status":       inv.status.value,
            "invoice_type": inv.invoice_type.value,
        })
        await db.commit()


async def get_invoice(invoice_id: str, user_id: str = "default") -> Optional[Invoice]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM invoices WHERE id=? AND user_id=?", (invoice_id, user_id)
        ) as cur:
            row = await cur.fetchone()
            return _row_to_invoice(row) if row else None


async def list_invoices(
    user_id: str = "default",
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[Invoice]:
    async with aiosqlite.connect(DB_PATH) as db:
        if status:
            sql    = "SELECT * FROM invoices WHERE user_id=? AND status=? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?"
            params = (user_id, status, limit, offset)
        else:
            sql    = "SELECT * FROM invoices WHERE user_id=? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?"
            params = (user_id, limit, offset)
        async with db.execute(sql, params) as cur:
            rows = await cur.fetchall()
            return [_row_to_invoice(r) for r in rows]


async def update_status(invoice_id: str, status: InvoiceStatus, error: str = "") -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE invoices SET status=?, error_message=? WHERE id=?",
            (status.value, error or None, invoice_id),
        )
        await db.commit()


async def get_stats_raw(user_id: str = "default") -> list[Invoice]:
    return await list_invoices(user_id=user_id, status="done", limit=10000)
