"""
InvoiceFlow — FastAPI application (v3 — auth + billing)
"""
from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.requests import Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from .auth import ClerkAuthMiddleware, get_current_user, get_clerk_user
from .billing import (
    Plan, check_can_process, check_feature, create_checkout_session,
    create_portal_session, get_subscription, increment_usage,
    init_billing_db, process_stripe_webhook,
)
from .config import UPLOAD_DIR, Settings, get_settings
from .db import get_invoice, get_stats_raw, init_db, list_invoices
from .models import Invoice, InvoiceStatus, StatsResponse
from .processor import process_file

# ── App setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="InvoiceFlow", version="0.3.0")
app.add_middleware(ClerkAuthMiddleware)

BASE_DIR  = Path(__file__).parent
from jinja2 import Environment, FileSystemLoader
_jinja_env = Environment(loader=FileSystemLoader("/app/templates"), auto_reload=True)
_jinja_env.cache = {}
templates = Jinja2Templates(env=_jinja_env)

settings: Settings = None  # type: ignore[assignment]


@app.on_event("startup")
async def startup():
    global settings
    settings = get_settings()
    await init_db()
    await init_billing_db()
    if settings.watch_folder:
        folder = Path(settings.watch_folder)
        if folder.exists():
            asyncio.create_task(_watch_folder(folder))


# ── Health check (public) ──────────────────────────────────────────────────────

@app.get("/health")
async def health():
    import os
    pk = os.getenv("CLERK_PUBLISHABLE_KEY", "NOT_FOUND")
    return {"status": "ok", "version": "0.3.0", "pk_loaded": pk[:20] if pk else "EMPTY"}


# ── Auth pages ─────────────────────────────────────────────────────────────────

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {
        "request": request,
        "clerk_publishable_key": os.getenv("CLERK_PUBLISHABLE_KEY", ""),
        "clerk_frontend_api": os.getenv("CLERK_FRONTEND_API", "infinite-kit-16.clerk.accounts.dev"),
    })


@app.get("/onboarding", response_class=HTMLResponse)
async def onboarding(request: Request, user_id: str = Depends(get_current_user)):
    """Post-signup: ensure subscription record exists, redirect to pricing."""
    await get_subscription(user_id)   # creates free plan record
    return RedirectResponse("/pricing")


# ── Dashboard ──────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, user_id: str = Depends(get_current_user)):
    invoices  = await list_invoices(user_id=user_id, limit=500)
    stats_raw = await get_stats_raw(user_id=user_id)
    stats     = _compute_stats(stats_raw)
    sub       = await get_subscription(user_id)
    user      = await get_clerk_user(user_id)

    top_category = max(stats.by_category, key=stats.by_category.get) \
                   if stats.by_category else ""

    return templates.TemplateResponse("dashboard.html", {
        "request":           request,
        "invoices":          invoices,
        "stats":             stats,
        "total":             len(invoices),
        "processed":         sum(1 for i in invoices if i.status == InvoiceStatus.DONE),
        "top_category":      top_category,
        "sheets_configured": bool(settings.google_credentials_file and settings.spreadsheet_id),
        "inbound_email":     settings.inbound_email_address or "",
        "watch_folder":      settings.watch_folder or "",
        "plan":              sub.get("plan", "free"),
        "invoices_used":     sub.get("invoices_this_month", 0),
        "invoices_limit":    30 if sub.get("plan") == "starter" else
                             (5 if sub.get("plan") == "free" else 999999),
        "user_email":        user.get("email", ""),
        "user_name":         user.get("first_name", ""),
    })


# ── Pricing ────────────────────────────────────────────────────────────────────

@app.get("/pricing", response_class=HTMLResponse)
async def pricing(request: Request, user_id: str = Depends(get_current_user)):
    sub = await get_subscription(user_id)
    return templates.TemplateResponse("pricing.html", {
        "request":      request,
        "current_plan": sub.get("plan", "free"),
    })


# ── Billing routes ─────────────────────────────────────────────────────────────

@app.get("/billing/checkout/{plan_name}")
async def billing_checkout(
    plan_name: str,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    try:
        plan = Plan(plan_name)
    except ValueError:
        raise HTTPException(400, f"Unknown plan: {plan_name}")

    user      = await get_clerk_user(user_id)
    base_url  = str(request.base_url).rstrip("/")

    url = await create_checkout_session(
        user_id=user_id,
        user_email=user.get("email", ""),
        plan=plan,
        success_url=f"{base_url}/billing/success",
        cancel_url=f"{base_url}/pricing",
    )
    return RedirectResponse(url)


@app.get("/billing/success", response_class=HTMLResponse)
async def billing_success(request: Request, user_id: str = Depends(get_current_user)):
    return HTMLResponse("""
    <html><head><meta http-equiv="refresh" content="2;url=/"></head>
    <body style="background:#0f1117;color:#e8ecf4;font-family:Inter,sans-serif;
                 display:flex;align-items:center;justify-content:center;height:100vh;
                 flex-direction:column;gap:12px;">
      <div style="font-size:40px;">🎉</div>
      <div style="font-size:20px;font-weight:700;">¡Suscripción activada!</div>
      <div style="color:#6b7a99;">Redirigiendo al dashboard…</div>
    </body></html>
    """)


@app.get("/billing/portal")
async def billing_portal(request: Request, user_id: str = Depends(get_current_user)):
    base_url = str(request.base_url).rstrip("/")
    url      = await create_portal_session(user_id, return_url=f"{base_url}/")
    return RedirectResponse(url)


@app.post("/api/billing/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
):
    payload = await request.body()
    try:
        result = await process_stripe_webhook(payload, stripe_signature or "")
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Invoice API ────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    allowed, reason = await check_can_process(user_id)
    if not allowed:
        raise HTTPException(402, reason)

    suffix = Path(file.filename or "file").suffix.lower()
    if suffix not in {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tiff"}:
        raise HTTPException(400, f"Tipo no soportado: {suffix}")

    dest    = UPLOAD_DIR / f"{uuid.uuid4().hex[:8]}_{user_id}_{file.filename}"
    content = await file.read()
    dest.write_bytes(content)

    inv = await process_file(dest, settings, user_id=user_id)
    if inv.status == InvoiceStatus.DONE:
        await increment_usage(user_id)

    return JSONResponse({
        "invoice_id": inv.id,
        "status":     inv.status.value,
        "message":    inv.error_message or "OK",
    })


@app.get("/api/invoice/{invoice_id}")
async def get_invoice_detail(
    invoice_id: str,
    user_id: str = Depends(get_current_user),
):
    inv = await get_invoice(invoice_id, user_id=user_id)
    if not inv:
        raise HTTPException(404, "Factura no encontrada")
    return JSONResponse(inv.model_dump(mode="json"))


@app.get("/api/invoices")
async def get_invoices(
    status: Optional[str] = None,
    limit: int = 200,
    user_id: str = Depends(get_current_user),
):
    invoices = await list_invoices(user_id=user_id, status=status, limit=limit)
    return [i.model_dump(mode="json") for i in invoices]


@app.get("/api/stats")
async def get_stats(user_id: str = Depends(get_current_user)):
    invoices = await get_stats_raw(user_id=user_id)
    return _compute_stats(invoices).model_dump()


@app.post("/api/export-all")
async def export_all_to_sheets(user_id: str = Depends(get_current_user)):
    has_sheets = await check_feature(user_id, "google_sheets")
    if not has_sheets:
        raise HTTPException(402, "Google Sheets requiere el plan Pro")
    if not settings.google_credentials_file or not settings.spreadsheet_id:
        raise HTTPException(400, "Google Sheets no configurado en el servidor")

    invoices = await get_stats_raw(user_id=user_id)
    from .sheets import SheetsExporter
    exporter = SheetsExporter(
        settings.google_credentials_file,
        settings.spreadsheet_id,
        settings.sheet_name,
    )
    exporter.export_batch(invoices)
    return {"exported": len(invoices)}


@app.get("/api/subscription")
async def subscription_status(user_id: str = Depends(get_current_user)):
    sub = await get_subscription(user_id)
    return sub


# ── Email inbound (public — has its own auth) ──────────────────────────────────

@app.post("/api/email/inbound")
async def email_inbound(
    request: Request,
    background_tasks: BackgroundTasks,
    x_postmark_signature: Optional[str] = Header(None),
):
    from .email_inbound import (
        email_context_note, is_sender_allowed,
        parse_mailgun, parse_postmark, parse_raw_mime, save_attachments,
    )

    if settings.email_webhook_secret:
        if (x_postmark_signature or "") != settings.email_webhook_secret:
            raise HTTPException(401, "Invalid webhook signature")

    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        email   = parse_postmark(payload)
    elif "multipart/form-data" in content_type:
        form  = await request.form()
        files = {k: v for k, v in form.items() if hasattr(v, "read")}
        data  = {k: v for k, v in form.items() if not hasattr(v, "read")}
        email = parse_mailgun(data, files)
    else:
        raw   = await request.body()
        email = parse_raw_mime(raw)

    if not is_sender_allowed(email.from_address, settings.email_sender_allowlist):
        return {"accepted": False, "reason": "sender_not_allowed"}

    if not email.has_attachments:
        return {"accepted": False, "reason": "no_valid_attachments"}

    paths = save_attachments(email)
    note  = email_context_note(email)

    # Email inbound: map sender to user (simplified — use first configured user)
    # In a multi-tenant setup, you'd look up the user by their inbound address token
    inbound_user_id = os.getenv("INBOUND_DEFAULT_USER_ID", "default")

    async def _process_all():
        allowed, _ = await check_can_process(inbound_user_id)
        if not allowed:
            return
        for path in paths:
            inv = await process_file(path, settings, user_id=inbound_user_id)
            if inv.status == InvoiceStatus.DONE:
                await increment_usage(inbound_user_id)
            if inv.notes:
                inv.notes = f"{note} | {inv.notes}"
            else:
                inv.notes = note
            from .db import save_invoice
            await save_invoice(inv)

    background_tasks.add_task(_process_all)
    return {"accepted": True, "attachments_queued": len(paths)}


@app.get("/api/email/status")
async def email_status(user_id: str = Depends(get_current_user)):
    has_email = await check_feature(user_id, "email_inbound")
    return {
        "configured":    bool(settings.inbound_email_address),
        "address":       settings.inbound_email_address or None,
        "available":     has_email,
        "provider":      settings.email_provider,
    }


# ── Stats helper ───────────────────────────────────────────────────────────────

def _compute_stats(invoices: list[Invoice]) -> StatsResponse:
    from collections import defaultdict
    done = errors = 0
    total_eur = 0.0
    by_cat: dict[str, float]    = defaultdict(float)
    by_vendor: dict[str, float] = defaultdict(float)
    by_month: dict[str, float]  = defaultdict(float)

    for inv in invoices:
        if inv.status == InvoiceStatus.DONE:  done += 1
        if inv.status == InvoiceStatus.ERROR: errors += 1
        if inv.total and inv.invoice_type.value == "received":
            total_eur += inv.total
            if inv.category: by_cat[inv.category]   += inv.total
            if inv.vendor:   by_vendor[inv.vendor]  += inv.total
            if inv.invoice_date:
                by_month[inv.invoice_date[:7]] += inv.total

    return StatsResponse(
        total=len(invoices), done=done, errors=errors,
        total_amount_eur=round(total_eur, 2),
        by_category=dict(by_cat),
        by_vendor=dict(by_vendor),
        by_month=dict(sorted(by_month.items())),
    )


# ── Folder watcher ─────────────────────────────────────────────────────────────

async def _watch_folder(folder: Path) -> None:
    try:
        from watchdog.events import FileSystemEventHandler
        from watchdog.observers import Observer

        default_user = os.getenv("INBOUND_DEFAULT_USER_ID", "default")

        class Handler(FileSystemEventHandler):
            def on_created(self, event):
                if event.is_directory: return
                p = Path(str(event.src_path))
                if p.suffix.lower() in {".pdf",".jpg",".jpeg",".png",".webp"}:
                    asyncio.create_task(process_file(p, settings, user_id=default_user))

        observer = Observer()
        observer.schedule(Handler(), str(folder), recursive=False)
        observer.start()
        print(f"👁  Watching: {folder}")
        while True:
            await asyncio.sleep(1)
    except ImportError:
        print("watchdog not installed")


# ── Entry point ────────────────────────────────────────────────────────────────

def run():
    s = get_settings()
    uvicorn.run("invoiceflow.main:app", host=s.host, port=s.port, reload=s.debug)


if __name__ == "__main__":
    run()


# ── Static files + PWA ────────────────────────────────────────────────────────
from fastapi.staticfiles import StaticFiles
import os as _os

_static_dir = Path(__file__).parent.parent / "static"
_static_dir.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


@app.get("/manifest.json")
async def manifest():
    from fastapi.responses import FileResponse
    p = _static_dir / "manifest.json"
    return FileResponse(str(p), media_type="application/manifest+json")


@app.get("/sw.js")
async def service_worker():
    from fastapi.responses import FileResponse
    p = _static_dir / "sw.js"
    return FileResponse(str(p), media_type="application/javascript",
                        headers={"Service-Worker-Allowed": "/"})


# ── Ticket capture ─────────────────────────────────────────────────────────────

@app.get("/capture", response_class=HTMLResponse)
async def capture_page(request: Request, user_id: str = Depends(get_current_user)):
    return templates.TemplateResponse("capture.html", {"request": request})


@app.post("/api/tickets/capture")
async def capture_ticket(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    """Receive ticket image, extract data, generate invoice request email."""
    from .ticket_extractor import extract_ticket
    from .ticket_request import (
        generate_request_email, save_ticket, clean_nif,
    )
    from .models import Ticket, TicketStatus
    import uuid

    allowed, reason = await check_can_process(user_id)
    if not allowed:
        raise HTTPException(402, reason)

    suffix = Path(file.filename or "ticket").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".heic"}:
        raise HTTPException(400, f"Tipo no soportado: {suffix}")

    # Save upload
    ticket_id = uuid.uuid4().hex[:12]
    dest      = UPLOAD_DIR / f"ticket_{ticket_id}_{user_id}{suffix}"
    dest.write_bytes(await file.read())

    # Extract with Claude Vision
    result = await extract_ticket(
        path=dest,
        api_key=settings.anthropic_api_key,
        model=settings.claude_model,
        my_company=settings.my_company_name,
        my_tax_id=settings.my_tax_id,
    )

    # Generate request email
    email_draft = generate_request_email(
        ticket=Ticket(id=ticket_id, user_id=user_id,
                      filename=dest.name, filepath=str(dest),
                      vendor_name=result.vendor_name,
                      vendor_nif=clean_nif(result.vendor_nif),
                      ticket_date=result.ticket_date,
                      total=result.total, concept=result.concept),
        my_name=settings.my_company_name or "Tu nombre",
        my_tax_id=settings.my_tax_id or "Tu NIF",
        my_email=settings.inbound_email_address or "",
    )

    # Build and persist ticket
    ticket = Ticket(
        id=ticket_id,
        user_id=user_id,
        filename=dest.name,
        filepath=str(dest),
        status=TicketStatus.PENDING_INVOICE,
        vendor_name=result.vendor_name,
        vendor_address=result.vendor_address,
        vendor_phone=result.vendor_phone,
        vendor_nif=clean_nif(result.vendor_nif),
        ticket_date=result.ticket_date,
        ticket_number=result.ticket_number,
        total=result.total,
        tax_rate=result.tax_rate,
        tax_amount=result.tax_amount,
        subtotal=result.subtotal,
        concept=result.concept,
        category=result.category,
        confidence=result.confidence,
        request_email_subject=email_draft.subject,
        request_email_body=email_draft.body,
    )
    await save_ticket(ticket)
    await increment_usage(user_id)

    return {"ticket_id": ticket_id, "status": ticket.status.value}


@app.get("/api/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user_id: str = Depends(get_current_user)):
    from .ticket_request import list_tickets
    tickets = await list_tickets(user_id=user_id)
    ticket  = next((t for t in tickets if t.id == ticket_id), None)
    if not ticket:
        raise HTTPException(404, "Ticket no encontrado")
    return ticket.model_dump(mode="json")


@app.get("/api/tickets")
async def get_tickets(
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    from .ticket_request import list_tickets
    tickets = await list_tickets(user_id=user_id, status=status)
    return [t.model_dump(mode="json") for t in tickets]


@app.post("/api/tickets/{ticket_id}/send-request")
async def send_invoice_request(
    ticket_id: str,
    body: dict,
    user_id: str = Depends(get_current_user),
):
    """Send or record an invoice request email for a ticket."""
    from .ticket_request import list_tickets, save_ticket, send_request_email
    from .ticket_request import InvoiceRequestEmail
    from .models import TicketStatus
    from datetime import datetime

    tickets = await list_tickets(user_id=user_id)
    ticket  = next((t for t in tickets if t.id == ticket_id), None)
    if not ticket:
        raise HTTPException(404, "Ticket no encontrado")

    to      = body.get("to", "")
    subject = body.get("subject", ticket.request_email_subject or "")
    text    = body.get("body",    ticket.request_email_body    or "")
    via_mailto = body.get("via_mailto", False)

    email_obj = InvoiceRequestEmail(
        to=to, subject=subject, body=text, found_contact=bool(to)
    )

    sent = False
    if not via_mailto and to:
        sent = await send_request_email(
            email_obj,
            resend_api_key=_os.getenv("RESEND_API_KEY", ""),
            from_email=settings.inbound_email_address or "",
        )

    # Update ticket
    ticket.request_email_to      = to
    ticket.request_email_subject = subject
    ticket.request_email_body    = text
    ticket.status                = TicketStatus.INVOICE_SENT
    ticket.request_sent_at       = datetime.now()
    await save_ticket(ticket)

    return {"sent": sent or via_mailto, "status": ticket.status.value}


@app.post("/api/tickets/{ticket_id}/expense-only")
async def mark_expense_only(ticket_id: str, user_id: str = Depends(get_current_user)):
    from .ticket_request import list_tickets, save_ticket
    from .models import TicketStatus
    tickets = await list_tickets(user_id=user_id)
    ticket  = next((t for t in tickets if t.id == ticket_id), None)
    if not ticket:
        raise HTTPException(404, "Ticket no encontrado")
    ticket.status = TicketStatus.EXPENSE_ONLY
    await save_ticket(ticket)
    return {"status": ticket.status.value}


# ── Gestor portal ──────────────────────────────────────────────────────────────

from fastapi.responses import StreamingResponse
import csv, io

@app.on_event("startup")
async def init_shares():
    from .share import init_shares_db
    await init_shares_db()


@app.get("/share/{token}", response_class=HTMLResponse)
async def gestor_portal(token: str, request: Request):
    """Public read-only portal for the gestor. No auth required."""
    from .share import get_share_link, get_shared_data, record_access

    share = await get_share_link(token)
    if not share:
        return HTMLResponse("<h2>Enlace no encontrado o expirado.</h2>", status_code=404)
    if share.get("expired"):
        return HTMLResponse("<h2>Este enlace ha caducado.</h2>", status_code=410)

    await record_access(token)

    data       = await get_shared_data(share)
    owner_name = share.get("user_id", "el usuario")

    # Try to get owner name from Clerk
    try:
        user = await get_clerk_user(share["user_id"])
        owner_name = user.get("first_name") or user.get("email") or owner_name
    except Exception:
        pass

    return templates.TemplateResponse("gestor.html", {
        "request":    request,
        "share":      share,
        "data":       data,
        "owner_name": owner_name,
    })


@app.get("/share/{token}/export.csv")
async def export_share_csv(token: str):
    """Download CSV of shared invoices — accessible without auth."""
    from .share import get_share_link, get_shared_data

    share = await get_share_link(token)
    if not share or share.get("expired"):
        raise HTTPException(404, "Enlace no encontrado o expirado")

    data = await get_shared_data(share)

    output = io.StringIO()
    writer = csv.writer(output)

    # Headers
    headers = ["Nº Factura","Fecha","Proveedor","NIF Proveedor",
               "Concepto","Categoría","Tipo"]
    if share["include_amounts"]:
        headers += ["Base Imponible","IVA %","Cuota IVA","Total","Moneda"]
    headers += ["Confianza"]
    writer.writerow(headers)

    for inv in data["invoices"]:
        row = [
            inv.invoice_number or "",
            inv.invoice_date   or "",
            inv.vendor         or "",
            inv.vendor_tax_id  or "",
            inv.concept        or "",
            inv.category       or "",
            inv.invoice_type.value,
        ]
        if share["include_amounts"]:
            row += [
                inv.subtotal   or "",
                f"{(inv.tax_rate or 0)*100:.0f}%" if inv.tax_rate else "",
                inv.tax_amount or "",
                inv.total      or "",
                inv.currency,
            ]
        row += [f"{inv.confidence:.0%}"]
        writer.writerow(row)

    output.seek(0)
    filename = f"facturas_{share.get('date_from','')[:7] or 'todas'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Share link management API ──────────────────────────────────────────────────

@app.post("/api/shares")
async def create_share(
    body: dict,
    request: Request,
    user_id: str = Depends(get_current_user),
):
    from .share import create_share_link, current_quarter_dates

    # Default: current quarter
    date_from = body.get("date_from")
    date_to   = body.get("date_to")
    if not date_from:
        date_from, date_to = current_quarter_dates()

    share = await create_share_link(
        user_id          = user_id,
        label            = body.get("label", ""),
        date_from        = date_from,
        date_to          = date_to,
        include_tickets  = bool(body.get("include_tickets", False)),
        include_amounts  = bool(body.get("include_amounts", True)),
        expires_days     = body.get("expires_days"),   # None = no expiry
    )

    base_url  = str(request.base_url).rstrip("/")
    share_url = f"{base_url}/share/{share['token']}"
    return {**share, "url": share_url}


@app.get("/api/shares")
async def list_shares(
    request: Request,
    user_id: str = Depends(get_current_user),
):
    from .share import list_share_links
    shares   = await list_share_links(user_id)
    base_url = str(request.base_url).rstrip("/")
    return [{**s, "url": f"{base_url}/share/{s['token']}"} for s in shares]


@app.delete("/api/shares/{token}")
async def delete_share(token: str, user_id: str = Depends(get_current_user)):
    from .share import delete_share_link
    deleted = await delete_share_link(token, user_id)
    if not deleted:
        raise HTTPException(404, "Link no encontrado")
    return {"deleted": True}


# ── VAT dashboard ──────────────────────────────────────────────────────────────

@app.get("/vat", response_class=HTMLResponse)
async def vat_dashboard(
    request: Request,
    year: Optional[int] = None,
    user_id: str = Depends(get_current_user),
):
    from .vat import (
        Quarter, compute_year_summary, current_quarter,
        all_quarters_for_year,
    )

    today     = __import__("datetime").date.today()
    view_year = year or today.year
    cq        = current_quarter()

    # Fetch all done invoices for this user
    all_invoices = await get_stats_raw(user_id=user_id)

    # Compute VAT for all 4 quarters
    quarters = compute_year_summary(all_invoices, view_year)

    # Which quarter to show initially
    current_q = cq.q if view_year == today.year else 1

    return templates.TemplateResponse("vat_dashboard.html", {
        "request":         request,
        "year":            view_year,
        "quarters":        quarters,
        "current_quarter": cq,
        "current_q":       current_q,
    })


@app.get("/vat/export/{year}/{q}")
async def export_vat_csv(
    year: int,
    q: int,
    format: str = "holded",
    user_id: str = Depends(get_current_user),
):
    """Download CSV export for a specific quarter."""
    from .vat import Quarter, compute_quarter_vat, invoices_to_holded_csv
    import io, csv as _csv

    if q not in range(1, 5):
        raise HTTPException(400, "Quarter must be 1–4")

    all_invoices = await get_stats_raw(user_id=user_id)
    quarter      = Quarter(year, q)
    qvat         = compute_quarter_vat(all_invoices, quarter)

    if format == "holded":
        content  = invoices_to_holded_csv(qvat.invoices)
        filename = f"303_{year}_Q{q}_holded.csv"
    else:
        # Contasol: simplified format, comma separator
        output = io.StringIO()
        writer = _csv.writer(output)
        writer.writerow(["FECHA","DOCUMENTO","TERCERO","NIF",
                         "CONCEPTO","BASE","TIPO_IVA","CUOTA","TOTAL","TIPO"])
        for inv in qvat.invoices:
            writer.writerow([
                inv.invoice_date   or "",
                inv.invoice_number or "",
                inv.vendor or inv.client or "",
                inv.vendor_tax_id  or inv.client_tax_id or "",
                inv.concept        or "",
                inv.subtotal       or "",
                f"{(inv.tax_rate or 0)*100:.0f}" if inv.tax_rate else "",
                inv.tax_amount     or "",
                inv.total          or "",
                "G" if inv.invoice_type.value == "received" else "I",
            ])
        output.seek(0)
        content  = output.read()
        filename = f"303_{year}_Q{q}_contasol.csv"

    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@app.get("/api/vat/{year}")
async def get_vat_summary(
    year: int,
    user_id: str = Depends(get_current_user),
):
    """JSON VAT summary for all quarters of a year."""
    from .vat import compute_year_summary

    all_invoices = await get_stats_raw(user_id=user_id)
    quarters     = compute_year_summary(all_invoices, year)

    return [
        {
            "quarter":             q.quarter.label,
            "date_from":           q.quarter.str_from,
            "date_to":             q.quarter.str_to,
            "deadline":            q.quarter.deadline.isoformat(),
            "days_until_deadline": q.quarter.days_until_deadline,
            "invoice_count":       q.invoice_count,
            "total_base_issued":   q.total_base_issued,
            "total_vat_issued":    q.total_vat_issued,
            "total_base_received": q.total_base_received,
            "total_vat_received":  q.total_vat_received,
            "resultado":           q.resultado,
            "resultado_label":     q.resultado_label,
            "missing_vat_count":   q.missing_vat_count,
        }
        for q in quarters
    ]
