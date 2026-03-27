"""
InvoiceFlow — Email inbound processing
Supports: Postmark (primary), Mailgun, raw MIME fallback

Flow:
  Email llega a Postmark → webhook POST a /api/email/inbound
  → parseamos adjuntos → processor.py → DB → Sheets
"""
from __future__ import annotations

import base64
import hashlib
import json
import uuid
from email import message_from_bytes
from email.policy import default as email_policy
from pathlib import Path
from typing import Any, Optional

from .config import UPLOAD_DIR, Settings
from .models import Invoice

# ── Allowed attachment types ───────────────────────────────────────────────────
ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/tiff",
}
ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tiff"}


# ── Postmark payload model (pure dict parsing, no Pydantic dep here) ──────────

class EmailAttachment:
    def __init__(self, name: str, content_type: str, data: bytes):
        self.name         = name
        self.content_type = content_type
        self.data         = data
        self.size         = len(data)

    @property
    def suffix(self) -> str:
        return Path(self.name).suffix.lower()

    @property
    def is_allowed(self) -> bool:
        return (
            self.content_type.lower() in ALLOWED_MIME
            or self.suffix in ALLOWED_EXT
        ) and self.size > 0 and self.size < 20 * 1024 * 1024  # 20 MB max


class ParsedEmail:
    def __init__(
        self,
        from_address: str,
        subject: str,
        body_text: str,
        attachments: list[EmailAttachment],
        message_id: str,
        provider: str = "postmark",
    ):
        self.from_address = from_address
        self.subject      = subject
        self.body_text    = body_text
        self.attachments  = attachments
        self.message_id   = message_id
        self.provider     = provider

    @property
    def has_attachments(self) -> bool:
        return any(a.is_allowed for a in self.attachments)

    @property
    def valid_attachments(self) -> list[EmailAttachment]:
        return [a for a in self.attachments if a.is_allowed]


# ── Postmark parser ────────────────────────────────────────────────────────────

def parse_postmark(payload: dict[str, Any]) -> ParsedEmail:
    """
    Parse a Postmark inbound webhook payload.
    Ref: https://postmarkapp.com/developer/user-guide/inbound/parse-an-email
    """
    attachments: list[EmailAttachment] = []

    for att in payload.get("Attachments", []):
        try:
            data = base64.b64decode(att.get("Content", ""))
            attachments.append(EmailAttachment(
                name         = att.get("Name", "attachment"),
                content_type = att.get("ContentType", "application/octet-stream"),
                data         = data,
            ))
        except Exception:
            continue

    return ParsedEmail(
        from_address = payload.get("From", ""),
        subject      = payload.get("Subject", ""),
        body_text    = payload.get("TextBody", "") or payload.get("HtmlBody", ""),
        attachments  = attachments,
        message_id   = payload.get("MessageID", uuid.uuid4().hex),
        provider     = "postmark",
    )


# ── Mailgun parser ─────────────────────────────────────────────────────────────

def parse_mailgun(form_data: dict[str, Any], files: dict[str, Any]) -> ParsedEmail:
    """
    Parse a Mailgun inbound webhook (multipart/form-data).
    Ref: https://documentation.mailgun.com/docs/mailgun/user-manual/receive-forward-store/
    """
    attachments: list[EmailAttachment] = []

    # Mailgun sends attachments as attachment-1, attachment-2, …
    att_count = int(form_data.get("attachment-count", 0))
    for i in range(1, att_count + 1):
        key = f"attachment-{i}"
        if key in files:
            f = files[key]
            attachments.append(EmailAttachment(
                name         = getattr(f, "filename", key),
                content_type = getattr(f, "content_type", "application/octet-stream"),
                data         = f.read() if hasattr(f, "read") else b"",
            ))

    return ParsedEmail(
        from_address = form_data.get("sender", form_data.get("from", "")),
        subject      = form_data.get("subject", ""),
        body_text    = form_data.get("body-plain", "") or form_data.get("stripped-text", ""),
        attachments  = attachments,
        message_id   = form_data.get("Message-Id", uuid.uuid4().hex),
        provider     = "mailgun",
    )


# ── Raw MIME parser (fallback / testing) ──────────────────────────────────────

def parse_raw_mime(raw: bytes) -> ParsedEmail:
    msg = message_from_bytes(raw, policy=email_policy)
    attachments: list[EmailAttachment] = []

    for part in msg.walk():
        ct = part.get_content_type()
        cd = part.get_content_disposition() or ""
        if "attachment" in cd or ct in ALLOWED_MIME:
            filename = part.get_filename() or f"attachment.{ct.split('/')[-1]}"
            payload  = part.get_payload(decode=True)
            if payload:
                attachments.append(EmailAttachment(
                    name=filename, content_type=ct, data=payload
                ))

    return ParsedEmail(
        from_address = str(msg.get("From", "")),
        subject      = str(msg.get("Subject", "")),
        body_text    = "",
        attachments  = attachments,
        message_id   = str(msg.get("Message-ID", uuid.uuid4().hex)),
        provider     = "raw",
    )


# ── Save attachments to disk ───────────────────────────────────────────────────

def save_attachments(email: ParsedEmail) -> list[Path]:
    """
    Write valid email attachments to UPLOAD_DIR.
    Returns list of saved paths.
    Deduplicates by content hash to avoid processing the same file twice.
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved: list[Path] = []

    for att in email.valid_attachments:
        # Dedup by MD5 — same file forwarded twice → skip
        content_hash = hashlib.md5(att.data).hexdigest()[:10]
        safe_name    = _safe_filename(att.name)
        dest         = UPLOAD_DIR / f"{content_hash}_{safe_name}"

        if dest.exists():
            # Already queued or processed
            saved.append(dest)
            continue

        dest.write_bytes(att.data)
        saved.append(dest)

    return saved


def _safe_filename(name: str) -> str:
    """Strip path components and replace unsafe chars."""
    name = Path(name).name  # drop any directory components
    safe = "".join(c if c.isalnum() or c in "._- " else "_" for c in name)
    return safe.strip()[:120] or "attachment"


# ── Email metadata for audit trail ────────────────────────────────────────────

def email_context_note(email: ParsedEmail) -> str:
    """Short string to store in invoice.notes for traceability."""
    return f"[email] from={email.from_address} subject={email.subject[:60]!r} id={email.message_id[:16]}"


# ── Security: sender allowlist ────────────────────────────────────────────────

def is_sender_allowed(
    from_address: str,
    allowlist: Optional[list[str]],
) -> bool:
    """
    If an allowlist is configured, only process emails from those addresses/domains.
    Empty allowlist = accept all (fine for personal use, risky for shared deploys).
    """
    if not allowlist:
        return True  # open — accepts everything

    from_lower = from_address.lower()
    for entry in allowlist:
        entry = entry.lower().strip()
        if entry.startswith("@"):
            # Domain match
            if from_lower.endswith(entry):
                return True
        else:
            if entry in from_lower:
                return True

    return False
