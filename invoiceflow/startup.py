"""
InvoiceFlow — Production health & startup utilities
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def check_env() -> list[str]:
    """
    Verify all required env vars are set.
    Returns list of missing variable names.
    """
    required = ["ANTHROPIC_API_KEY"]
    optional_but_warn = [
        "CLERK_PUBLISHABLE_KEY",
        "CLERK_SECRET_KEY",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "STRIPE_PRICE_STARTER",
        "STRIPE_PRICE_PRO",
    ]
    missing  = [v for v in required if not os.getenv(v)]
    missing_warn = [v for v in optional_but_warn if not os.getenv(v)]
    return missing, missing_warn


def ensure_data_dirs() -> None:
    """Create all required data directories."""
    from .config import DATA_DIR, UPLOAD_DIR, PROCESSED_DIR, HISTORY_DIR
    for d in [DATA_DIR, UPLOAD_DIR, PROCESSED_DIR]:
        d.mkdir(parents=True, exist_ok=True)


def get_version() -> str:
    from . import __version__
    return __version__


HISTORY_DIR = Path.home() / ".invoiceflow" / "history"
