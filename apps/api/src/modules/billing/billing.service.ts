import Stripe from 'stripe'
import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import { redis } from '../../redis.js'

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })

// ── Get or create Stripe customer ────────────────────────

async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const [sub] = await db`
    SELECT stripe_customer_id FROM billing.subscriptions WHERE user_id = ${userId}
  `
  if (sub?.stripeCustomerId) return sub.stripeCustomerId

  const [user] = await db`SELECT email, display_name FROM users WHERE id = ${userId}`
  if (!user) throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404)

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.displayName ?? undefined,
    metadata: { userId },
  })

  // Upsert subscription row with customer ID
  await db`
    INSERT INTO billing.subscriptions (user_id, stripe_customer_id, plan_id, status)
    VALUES (
      ${userId},
      ${customer.id},
      (SELECT id FROM billing.plans WHERE slug = 'free'),
      'active'
    )
    ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = ${customer.id}, updated_at = NOW()
  `

  return customer.id
}

// ── Create checkout session ───────────────────────────────

export async function createCheckoutSession(userId: string, priceId: string, period: 'monthly' | 'annual') {
  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.BILLING_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: env.BILLING_CANCEL_URL,
    metadata: { userId, period },
    subscription_data: {
      metadata: { userId, period },
      trial_period_days: 14,  // 14-day trial
    },
    payment_method_types: ['card', 'sepa_debit'],
    locale: 'es',
  })

  return { url: session.url!, sessionId: session.id }
}

// ── Create customer portal session ───────────────────────

export async function createPortalSession(userId: string) {
  const customerId = await getOrCreateStripeCustomer(userId)

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: env.BILLING_PORTAL_RETURN_URL,
  })

  return { url: session.url }
}

// ── Get current subscription ──────────────────────────────

export async function getSubscription(userId: string) {
  const [sub] = await db`
    SELECT
      s.id, s.status, s.billing_period, s.cancel_at_period_end,
      s.current_period_start, s.current_period_end, s.trial_end,
      p.slug AS plan_slug, p.name AS plan_name, p.price_monthly_eur, p.price_annual_eur,
      p.invoice_limit, p.ocr_limit, p.ai_daily_limit, p.email_limit
    FROM billing.subscriptions s
    JOIN billing.plans p ON s.plan_id = p.id
    WHERE s.user_id = ${userId}
  `
  return sub ?? { planSlug: 'free', planName: 'Lefse FREE', status: 'active' }
}

// ── Get usage for current period ─────────────────────────

export async function getCurrentUsage(userId: string) {
  const periodMonth = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
  const [usage] = await db`
    SELECT invoices_count, ocr_count, ai_queries_count, email_count
    FROM billing.usage_tracking
    WHERE user_id = ${userId} AND period_month = ${periodMonth}
  `
  return usage ?? { invoicesCount: 0, ocrCount: 0, aiQueriesCount: 0, emailCount: 0 }
}

// ── List available plans ──────────────────────────────────

export async function listPlans() {
  return db`
    SELECT slug, name, invoice_limit, ocr_limit, ai_daily_limit, email_limit,
           price_monthly_eur, price_annual_eur,
           stripe_price_monthly_id, stripe_price_annual_id
    FROM billing.plans
    WHERE is_active = true
    ORDER BY price_monthly_eur ASC
  `
}

// ── Stripe Webhook Handlers ───────────────────────────────

export async function handleStripeWebhook(payload: Buffer, signature: string) {
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    throw new AppError('INVALID_WEBHOOK_SIGNATURE', 'Firma webhook inválida', 400)
  }

  // Idempotency: skip already-processed events
  const [existing] = await db`
    SELECT id FROM billing.billing_events WHERE stripe_event_id = ${event.id}
  `
  if (existing) return { status: 'duplicate' }

  // Store event (append-only)
  const userId = await resolveUserIdFromEvent(event)
  await db`
    INSERT INTO billing.billing_events (stripe_event_id, event_type, user_id, stripe_customer_id, payload)
    VALUES (
      ${event.id},
      ${event.type},
      ${userId},
      ${(event.data.object as any).customer ?? null},
      ${JSON.stringify(event.data.object)}
    )
  `

  // Handle event
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpsert(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
      break
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break
    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object as Stripe.Subscription)
      break
  }

  return { status: 'processed', eventType: event.type }
}

async function resolveUserIdFromEvent(event: Stripe.Event): Promise<string | null> {
  const obj = event.data.object as any
  const customerId = obj.customer
  if (!customerId) return null

  const [sub] = await db`
    SELECT user_id FROM billing.subscriptions WHERE stripe_customer_id = ${customerId}
  `
  return sub?.userId ?? null
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription) {
  const customerId = sub.customer as string
  const priceId = sub.items.data[0]?.price.id
  const productId = sub.items.data[0]?.price.product as string

  // Find plan by stripe_product_id
  const [plan] = await db`SELECT id FROM billing.plans WHERE stripe_product_id = ${productId}`
  if (!plan) return  // unknown product, skip

  const period = sub.items.data[0]?.price.recurring?.interval === 'year' ? 'annual' : 'monthly'

  await db`
    UPDATE billing.subscriptions SET
      plan_id = ${plan.id},
      stripe_subscription_id = ${sub.id},
      status = ${sub.status},
      billing_period = ${period},
      current_period_start = ${new Date(sub.current_period_start * 1000)},
      current_period_end = ${new Date(sub.current_period_end * 1000)},
      cancel_at_period_end = ${sub.cancel_at_period_end},
      trial_end = ${sub.trial_end ? new Date(sub.trial_end * 1000) : null},
      updated_at = NOW()
    WHERE stripe_customer_id = ${customerId}
  `

  // Invalidate plan cache
  await invalidatePlanCache(customerId)
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const [plan] = await db`SELECT id FROM billing.plans WHERE slug = 'free'`

  await db`
    UPDATE billing.subscriptions SET
      plan_id = ${plan.id},
      stripe_subscription_id = NULL,
      status = 'canceled',
      updated_at = NOW()
    WHERE stripe_customer_id = ${sub.customer as string}
  `

  await invalidatePlanCache(sub.customer as string)
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  await db`
    UPDATE billing.subscriptions SET
      at_risk = false,
      updated_at = NOW()
    WHERE stripe_customer_id = ${invoice.customer as string}
  `
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  await db`
    UPDATE billing.subscriptions SET
      at_risk = true,
      updated_at = NOW()
    WHERE stripe_customer_id = ${invoice.customer as string}
  `
}

async function handleTrialWillEnd(sub: Stripe.Subscription) {
  const [userRow] = await db`
    SELECT user_id FROM billing.subscriptions WHERE stripe_customer_id = ${sub.customer as string}
  `
  if (!userRow) return

  // Import here to avoid circular dependency
  const { createNotification } = await import('../notifications/notifications.service.js')
  await createNotification({
    userId: userRow.userId,
    type: 'SYSTEM',
    title: '⏳ Tu prueba gratuita termina pronto',
    body: 'Tu período de prueba de 14 días termina en 3 días. Suscríbete para continuar usando todas las funciones.',
    actionUrl: '/billing',
  })
}

async function invalidatePlanCache(customerId: string) {
  const [sub] = await db`SELECT user_id FROM billing.subscriptions WHERE stripe_customer_id = ${customerId}`
  if (sub?.userId) await redis.del(`plan:${sub.userId}`)
}
