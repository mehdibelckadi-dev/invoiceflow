"""
InvoiceFlow — Billing via Stripe
https://stripe.com

Plans:
  starter  → 9 €/month  → 30 facturas/mes
  pro      → 19 €/month → ilimitado + Sheets + email inbound

Setup (15 min):
  1. stripe.com → crear cuenta → activar modo test
  2. Crear dos Products + Prices en el dashboard de Stripe
  3. Copiar price IDs al .env
  4. stripe listen --forward-to localhost:8000/api/billing/webhook  (dev)
  5. En producción: Stripe dashboard → Webhooks → añadir endpoint
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from enum import Enum
from typing import Optional

import aiosqlite

from .config import DB_PATH

# ── Plans ──────────────────────────────────────────────────────────────────────

class Plan(str, Enum):
    FREE    = "free"      # sin cuenta de pago — 5 facturas/mes para probar
    STARTER = "starter"   # 9 €/mes — 30 facturas/mes
    PRO     = "pro"       # 19 €/mes — ilimitado

PLAN_LIMITS: dict[Plan, int] = {
    Plan.FREE:    5,
    Plan.STARTER: 30,
    Plan.PRO:     999_999,
}

PLAN_FEATURES: dict[Plan, set[str]] = {
    Plan.FREE:    {"upload"},
    Plan.STARTER: {"upload", "email_inbound", "watch_folder"},
    Plan.PRO:     {"upload", "email_inbound", "watch_folder", "google_sheets", "priority_support"},
}

PLAN_PRICES_EUR = {Plan.FREE: 0, Plan.STARTER: 9, Plan.PRO: 19}


# ── DB schema for subscriptions ────────────────────────────────────────────────

CREATE_SUBSCRIPTIONS_TABLE = """
CREATE TABLE IF NOT EXISTS subscriptions (
    user_id             TEXT PRIMARY KEY,
    plan                TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id  TEXT,
    stripe_sub_id       TEXT,
    status              TEXT DEFAULT 'active',
    current_period_end  INTEGER,      -- unix timestamp
    invoices_this_month INTEGER DEFAULT 0,
    month_reset_at      INTEGER,      -- unix timestamp, reset counter monthly
    updated_at          INTEGER
);
"""


async def init_billing_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(CREATE_SUBSCRIPTIONS_TABLE)
        await db.commit()


# ── Subscription CRUD ──────────────────────────────────────────────────────────

async def get_subscription(user_id: str) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT * FROM subscriptions WHERE user_id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        # Auto-create free plan on first access
        await upsert_subscription(user_id, Plan.FREE)
        return {"user_id": user_id, "plan": "free", "invoices_this_month": 0,
                "status": "active", "current_period_end": None}

    cols = ["user_id","plan","stripe_customer_id","stripe_sub_id","status",
            "current_period_end","invoices_this_month","month_reset_at","updated_at"]
    return dict(zip(cols, row))


async def upsert_subscription(
    user_id: str,
    plan: Plan,
    stripe_customer_id: Optional[str] = None,
    stripe_sub_id: Optional[str] = None,
    status: str = "active",
    current_period_end: Optional[int] = None,
) -> None:
    now = int(time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO subscriptions
                (user_id, plan, stripe_customer_id, stripe_sub_id,
                 status, current_period_end, invoices_this_month, month_reset_at, updated_at)
            VALUES (?,?,?,?,?,?,0,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
                plan=excluded.plan,
                stripe_customer_id=COALESCE(excluded.stripe_customer_id, stripe_customer_id),
                stripe_sub_id=COALESCE(excluded.stripe_sub_id, stripe_sub_id),
                status=excluded.status,
                current_period_end=excluded.current_period_end,
                updated_at=excluded.updated_at
        """, (user_id, plan.value, stripe_customer_id, stripe_sub_id,
              status, current_period_end, now, now))
        await db.commit()


async def increment_usage(user_id: str) -> None:
    """Call this every time a invoice is successfully processed."""
    now = int(time.time())
    # Reset counter if new calendar month
    month_start = _month_start_ts()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            UPDATE subscriptions SET
                invoices_this_month = CASE
                    WHEN month_reset_at < ? THEN 1
                    ELSE invoices_this_month + 1
                END,
                month_reset_at = CASE
                    WHEN month_reset_at < ? THEN ?
                    ELSE month_reset_at
                END
            WHERE user_id = ?
        """, (month_start, month_start, now, user_id))
        await db.commit()


def _month_start_ts() -> int:
    """Unix timestamp for the first second of the current month."""
    import datetime
    now = datetime.datetime.now()
    return int(datetime.datetime(now.year, now.month, 1).timestamp())


# ── Usage gate ─────────────────────────────────────────────────────────────────

async def check_can_process(user_id: str) -> tuple[bool, str]:
    """
    Returns (allowed, reason).
    Call before processing each invoice.
    """
    sub = await get_subscription(user_id)
    plan = Plan(sub["plan"])

    if sub["status"] not in ("active", "trialing"):
        return False, "Suscripción inactiva. Revisa tu plan en /billing."

    limit = PLAN_LIMITS[plan]
    used  = sub.get("invoices_this_month", 0)

    if used >= limit:
        plan_name = plan.value
        next_plan = "Pro (19€/mes)" if plan == Plan.STARTER else "plan Starter (9€/mes)"
        return False, (
            f"Has alcanzado el límite de {limit} facturas/mes del plan {plan_name}. "
            f"Actualiza a {next_plan} para continuar."
        )

    return True, ""


async def check_feature(user_id: str, feature: str) -> bool:
    """Check if a user's plan includes a specific feature."""
    sub  = await get_subscription(user_id)
    plan = Plan(sub["plan"])
    return feature in PLAN_FEATURES[plan]


# ── Stripe helpers ─────────────────────────────────────────────────────────────

def get_stripe():
    import stripe
    stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    return stripe


async def create_checkout_session(
    user_id: str,
    user_email: str,
    plan: Plan,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout session. Returns the checkout URL."""
    stripe = get_stripe()

    price_id_key = f"STRIPE_PRICE_{plan.value.upper()}"
    price_id     = os.getenv(price_id_key, "")
    if not price_id:
        raise ValueError(f"Missing env var: {price_id_key}")

    sub = await get_subscription(user_id)
    customer_id = sub.get("stripe_customer_id")

    # Create customer if first time
    if not customer_id:
        customer    = stripe.Customer.create(email=user_email, metadata={"user_id": user_id})
        customer_id = customer.id
        await upsert_subscription(user_id, Plan(sub["plan"]),
                                  stripe_customer_id=customer_id)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url + "?session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "plan": plan.value},
        subscription_data={
            "trial_period_days": 7,   # 7 días gratis al empezar
            "metadata": {"user_id": user_id},
        },
    )
    return session.url


async def create_portal_session(user_id: str, return_url: str) -> str:
    """Stripe billing portal — manage subscription, cancel, update card."""
    stripe  = get_stripe()
    sub     = await get_subscription(user_id)
    cust_id = sub.get("stripe_customer_id")

    if not cust_id:
        raise ValueError("No Stripe customer found for this user")

    session = stripe.billing_portal.Session.create(
        customer=cust_id,
        return_url=return_url,
    )
    return session.url


# ── Webhook processor ──────────────────────────────────────────────────────────

async def process_stripe_webhook(payload: bytes, sig_header: str) -> dict:
    """
    Verify and process a Stripe webhook event.
    Returns {"handled": True/False, "event_type": ...}
    """
    stripe       = get_stripe()
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid Stripe webhook signature")

    event_type = event["type"]
    data_obj   = event["data"]["object"]

    # ── Subscription activated / updated ──────────────────────────────────────
    if event_type in ("customer.subscription.created",
                      "customer.subscription.updated"):
        user_id = data_obj.get("metadata", {}).get("user_id")
        if user_id:
            plan_name = _plan_from_stripe_sub(data_obj)
            await upsert_subscription(
                user_id=user_id,
                plan=plan_name,
                stripe_customer_id=data_obj.get("customer"),
                stripe_sub_id=data_obj.get("id"),
                status=data_obj.get("status", "active"),
                current_period_end=data_obj.get("current_period_end"),
            )

    # ── Subscription cancelled / payment failed ────────────────────────────────
    elif event_type in ("customer.subscription.deleted",
                        "invoice.payment_failed"):
        user_id = data_obj.get("metadata", {}).get("user_id")
        if user_id:
            sub = await get_subscription(user_id)
            await upsert_subscription(
                user_id=user_id,
                plan=Plan.FREE,
                stripe_customer_id=sub.get("stripe_customer_id"),
                stripe_sub_id=sub.get("stripe_sub_id"),
                status="canceled" if "deleted" in event_type else "past_due",
            )

    # ── Checkout completed ─────────────────────────────────────────────────────
    elif event_type == "checkout.session.completed":
        user_id = data_obj.get("metadata", {}).get("user_id")
        plan_str = data_obj.get("metadata", {}).get("plan", "starter")
        if user_id:
            await upsert_subscription(
                user_id=user_id,
                plan=Plan(plan_str),
                stripe_customer_id=data_obj.get("customer"),
                stripe_sub_id=data_obj.get("subscription"),
                status="active",
            )

    return {"handled": True, "event_type": event_type}


def _plan_from_stripe_sub(sub_obj: dict) -> Plan:
    """Infer our Plan enum from a Stripe subscription object."""
    items  = sub_obj.get("items", {}).get("data", [])
    if not items:
        return Plan.FREE
    price_id = items[0].get("price", {}).get("id", "")

    starter_price = os.getenv("STRIPE_PRICE_STARTER", "")
    pro_price     = os.getenv("STRIPE_PRICE_PRO", "")

    if price_id == pro_price:
        return Plan.PRO
    if price_id == starter_price:
        return Plan.STARTER
    return Plan.FREE
