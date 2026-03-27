"""
InvoiceFlow — Configuration
Railway-compatible: usa /data en producción si existe, ~/.invoiceflow en local.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Data directory — Railway mounts /data as persistent volume ────────────────
def _data_dir() -> Path:
    """
    Railway: monta un volumen persistente en /data.
    Local: usa ~/.invoiceflow.
    Se puede forzar con DATA_DIR env var.
    """
    if os.getenv("DATA_DIR"):
        return Path(os.getenv("DATA_DIR"))
    if Path("/data").exists() and os.access("/data", os.W_OK):
        return Path("/data/invoiceflow")
    return Path.home() / ".invoiceflow"

DATA_DIR      = _data_dir()
DB_PATH       = DATA_DIR / "invoices.db"
UPLOAD_DIR    = DATA_DIR / "uploads"
PROCESSED_DIR = DATA_DIR / "processed"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Anthropic
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    # App
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    base_url: str = ""          # e.g. https://invoiceflow.up.railway.app
    watch_folder: Optional[str] = None

    # Google Sheets (optional)
    google_credentials_file: Optional[str] = None
    spreadsheet_id: Optional[str] = None
    sheet_name: str = "Facturas"

    # Business context
    my_company_name: str = ""
    my_tax_id: str = ""

    # Email inbound
    email_webhook_secret: str = ""
    email_sender_allowlist: list[str] = Field(default_factory=list)
    email_provider: str = "postmark"
    inbound_email_address: str = ""

    # Clerk
    clerk_publishable_key: str = ""
    clerk_secret_key: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_pro: str = ""

    # Resend (email de solicitud de facturas)
    resend_api_key: str = ""

    # Single-user inbound default
    inbound_default_user_id: str = "default"


def get_settings() -> Settings:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    return Settings()
