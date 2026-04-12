# Billing — Lefse B6
_Generado: 2026-04-07 | Estado: 🟢 Completo_

---

## ANÁLISIS DE PRECIOS

Los precios propuestos se mantienen. Razón: coste marginal por usuario en FREE es ~€0.08/mes (Mistral + Mindee + Uanataca mínimos). El STARTER a €9 cubre costes variables con margen desde el primer usuario activo. El PRO a €29 es competitivo frente a Holded (€24-49) y Billin (€19-39) con diferenciación por sello eIDAS incluido. AGENCY a €79 está por debajo de Sage 50 y Contasol Pro, justificado por multi-workspace limitado al inicio.

| Plan | Precio mensual | Precio anual (-20%) | Ahorro anual |
|------|---------------|---------------------|-------------|
| FREE | €0 | €0 | — |
| STARTER | €9/mes | €86.40/año (€7.20/mes) | €21.60 |
| PRO | €29/mes | €278.40/año (€23.20/mes) | €69.60 |
| AGENCY | €79/mes | €758.40/año (€63.20/mes) | €189.60 |

---

## ENTREGABLE 1 — PRODUCTOS Y PRECIOS EN STRIPE

### Estructura Products + Prices

```javascript
stripe.products.create({
  name: 'Lefse STARTER',
  metadata: { plan_slug: 'starter' }
})

stripe.products.create({
  name: 'Lefse PRO',
  metadata: { plan_slug: 'pro' }
})

stripe.products.create({
  name: 'Lefse AGENCY',
  metadata: { plan_slug: 'agency' }
})
```

### Price IDs por plan y periodicidad

| Plan | Periodicidad | Precio | Price ID (var env) |
|------|-------------|--------|--------------------|
| STARTER | mensual | €9.00 | STRIPE_PRICE_STARTER_MONTHLY |
| STARTER | anual | €86.40 | STRIPE_PRICE_STARTER_ANNUAL |
| PRO | mensual | €29.00 | STRIPE_PRICE_PRO_MONTHLY |
| PRO | anual | €278.40 | STRIPE_PRICE_PRO_ANNUAL |
| AGENCY | mensual | €79.00 | STRIPE_PRICE_AGENCY_MONTHLY |
| AGENCY | anual | €758.40 | STRIPE_PRICE_AGENCY_ANNUAL |

### Metadata en cada Price

```json
{
  "plan_slug": "pro",
  "invoice_limit": "150",
  "ocr_limit": "100",
  "ai_limit": "-1",
  "email_limit": "-1",
  "billing_period": "monthly"
}
```

Para ilimitado usar valor `"-1"`. PlanGuard interpreta `-1` como sin restricción.

### Stripe Tax

```javascript
stripe.tax.settings.update({
  defaults: {
    tax_behavior: 'exclusive',
    tax_code: 'txcd_20030000'  // Software as a Service
  }
})
```

- Activar Stripe Tax en Dashboard → Tax → Enable
- Registro de IVA: España (ES) — VAT OSS si aplica clientes UE
- Modo: `automatic_tax: { enabled: true }` en todas las Checkout Sessions

### Coupon descuento anual

```javascript
stripe.coupons.create({
  id: 'ANNUAL_20',
  percent_off: 20,
  duration: 'forever',
  name: 'Plan Anual — 20% descuento',
  metadata: { type: 'annual_billing' }
})
```

Nota: el descuento ya está incorporado en los Price IDs anuales. El coupon `ANNUAL_20` se usa para upsell en checkout mensual → anual si el usuario cambia de opción dentro del mismo flujo.

---

## ENTREGABLE 2 — CHECKOUT Y PORTAL

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /billing/checkout | JWT | Crear Stripe Checkout Session |
| POST | /billing/portal | JWT | Crear Customer Portal Session |
| GET | /billing/subscription | JWT | Estado actual suscripción |
| GET | /billing/usage | JWT | Uso actual del período |
| GET | /billing/invoices | JWT | Historial facturas Stripe |

---

### POST /billing/checkout

**Body:**
```typescript
{
  plan_slug: enum('starter', 'pro', 'agency'),
  billing_period: enum('monthly', 'annual'),
  success_url?: string,  // default: APP_URL/dashboard?upgrade=success
  cancel_url?: string    // default: APP_URL/pricing
}
```

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_live_..."
}
```

**Lógica:**
```
1. Zod: plan_slug IN (starter, pro, agency), billing_period IN (monthly, annual)
2. Verificar usuario autenticado (JWT válido)
3. Verificar usuario no tiene ya una suscripción activa del mismo plan
4. Crear/recuperar Stripe Customer:
   a. SELECT users WHERE id = req.user.id → stripe_customer_id
   b. Si stripe_customer_id IS NULL:
      customer = stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id, lefse_env: NODE_ENV }
      })
      UPDATE users SET stripe_customer_id = customer.id
   c. Si existe → stripe.customers.retrieve(stripe_customer_id)
5. Resolver priceId según plan_slug + billing_period desde config:
   PRICE_MAP[plan_slug][billing_period] → priceId
6. stripe.checkout.sessions.create({
     customer: stripe_customer_id,
     mode: 'subscription',
     line_items: [{ price: priceId, quantity: 1 }],
     allow_promotion_codes: true,
     automatic_tax: { enabled: true },
     customer_update: { address: 'auto', name: 'auto' },
     billing_address_collection: 'required',
     tax_id_collection: { enabled: true },
     success_url: success_url + '?session_id={CHECKOUT_SESSION_ID}',
     cancel_url: cancel_url,
     metadata: {
       userId: user.id,
       plan_slug: plan_slug,
       billing_period: billing_period
     },
     subscription_data: {
       metadata: {
         userId: user.id,
         plan_slug: plan_slug
       }
     }
   })
7. INSERT audit_log (action=BILLING_CHECKOUT_CREATED, entity=checkout_session)
8. Retornar { checkoutUrl: session.url }
```

**Errores:**
| Code | HTTP | Descripción |
|------|------|-------------|
| BILLING_ALREADY_SUBSCRIBED | 409 | Ya tiene suscripción activa al mismo plan |
| BILLING_INVALID_PLAN | 422 | plan_slug no válido |
| BILLING_STRIPE_ERROR | 502 | Error en Stripe API |

---

### POST /billing/portal

**Body:** `{}` (sin body requerido)

**Response:**
```json
{
  "portalUrl": "https://billing.stripe.com/session/..."
}
```

**Lógica:**
```
1. Verificar usuario autenticado
2. SELECT stripe_customer_id FROM users WHERE id = req.user.id
3. Si stripe_customer_id IS NULL → 404 BILLING_NO_CUSTOMER
4. stripe.billingPortal.sessions.create({
     customer: stripe_customer_id,
     return_url: APP_URL + '/dashboard'
   })
5. Retornar { portalUrl: session.url }
```

---

### GET /billing/subscription

**Response:**
```typescript
{
  plan: 'free' | 'starter' | 'pro' | 'agency',
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'none',
  billing_period: 'monthly' | 'annual' | null,
  current_period_start: ISO8601 | null,
  current_period_end: ISO8601 | null,
  cancel_at_period_end: boolean,
  stripe_subscription_id: string | null
}
```

**Lógica:**
```
1. Verificar usuario autenticado
2. SELECT subscriptions JOIN plans WHERE user_id = req.user.id
3. Si no existe → retornar { plan: 'free', status: 'none', ... }
4. Retornar datos de subscriptions JOIN plans
```

---

### GET /billing/usage

**Response:**
```typescript
{
  period_month: string,      // YYYY-MM
  invoices: { used: number, limit: number },
  ocr: { used: number, limit: number },
  ai_queries: { used: number, limit: number | null },
  emails: { used: number, limit: number | null }
}
```

**Lógica:**
```
1. Verificar usuario autenticado
2. period_month = format(NOW(), 'YYYY-MM')
3. SELECT usage_tracking WHERE user_id = ? AND period_month = ?
4. SELECT plan limits desde subscriptions JOIN plans (o FREE defaults si no hay sub)
5. Retornar comparativa usado vs límite (-1 = null en respuesta = ilimitado)
```

---

### GET /billing/invoices

**Query params:** `?limit=10&starting_after=in_xxx`

**Response:**
```typescript
{
  items: [{
    id: string,
    amount_paid: number,
    currency: string,
    status: string,
    invoice_pdf: string,
    period_start: ISO8601,
    period_end: ISO8601,
    hosted_invoice_url: string
  }],
  has_more: boolean
}
```

**Lógica:**
```
1. Verificar usuario autenticado
2. SELECT stripe_customer_id FROM users
3. Si NULL → retornar { items: [], has_more: false }
4. stripe.invoices.list({
     customer: stripe_customer_id,
     limit: Math.min(limit, 24),
     starting_after: starting_after || undefined
   })
5. Mapear fields relevantes
6. Retornar { items, has_more }
```

---

## ENTREGABLE 3 — WEBHOOKS STRIPE

### POST /webhooks/stripe

**Verificación firma:**
```javascript
const sig = request.headers['stripe-signature']
const rawBody = request.rawBody  // Fastify: addContentTypeParser para preservar raw

let event
try {
  event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
} catch (err) {
  return reply.status(400).send({ error: 'Invalid signature' })
}
```

**Idempotencia (SIEMPRE antes de procesar cada evento):**
```sql
SELECT id FROM billing.billing_events WHERE stripe_event_id = $1
-- Si existe → retornar HTTP 200 inmediatamente sin procesar
```

---

### Evento: `checkout.session.completed`

**Pseudocódigo:**
```
1. Verificar idempotencia (stripe_event_id en billing_events)
2. session = event.data.object
3. Si session.mode !== 'subscription' → ignorar (retornar 200)
4. userId = session.metadata.userId
5. plan_slug = session.metadata.plan_slug
6. billing_period = session.metadata.billing_period
7. stripe_subscription_id = session.subscription
8. sub = stripe.subscriptions.retrieve(stripe_subscription_id)
9. SELECT id FROM billing.plans WHERE slug = plan_slug → plan_id
10. UPSERT billing.subscriptions {
      user_id: userId,
      plan_id: plan_id,
      stripe_subscription_id: sub.id,
      stripe_customer_id: sub.customer,
      status: sub.status,
      billing_period: billing_period,
      current_period_start: fromUnix(sub.current_period_start),
      current_period_end: fromUnix(sub.current_period_end),
      cancel_at_period_end: sub.cancel_at_period_end
    } ON CONFLICT (user_id) DO UPDATE SET ...
11. UPDATE users SET plan = plan_slug, stripe_customer_id = sub.customer
12. UPSERT billing.usage_tracking {
      user_id: userId,
      period_month: format(NOW(), 'YYYY-MM'),
      invoices_count: 0, ocr_count: 0,
      ai_queries_count: 0, email_count: 0
    } ON CONFLICT (user_id, period_month) DO NOTHING
13. INSERT billing.billing_events { stripe_event_id, type, user_id, payload }
14. AWAIT redis.del('plan:' + userId)  -- Invalidar cache
15. Disparar email: "Bienvenida al plan X"
16. INSERT audit_log (action=PLAN_ACTIVATED, entity=subscription, entity_id=sub.id)
```

**Tablas:** `billing.subscriptions`, `users`, `billing.usage_tracking`, `billing.billing_events`, `audit_log`
**Notificación:** Email bienvenida + notificación in-app "Plan activado"

---

### Evento: `customer.subscription.updated`

**Pseudocódigo:**
```
1. Verificar idempotencia
2. sub = event.data.object
3. prev_sub = event.data.previous_attributes
4. userId = sub.metadata.userId
5. nuevo_plan_slug = sub.metadata.plan_slug
6. SELECT id FROM billing.plans WHERE slug = nuevo_plan_slug → plan_id
7. UPDATE billing.subscriptions SET
     plan_id = plan_id,
     status = sub.status,
     current_period_start = fromUnix(sub.current_period_start),
     current_period_end = fromUnix(sub.current_period_end),
     cancel_at_period_end = sub.cancel_at_period_end
   WHERE user_id = userId
8. SELECT plan FROM users WHERE id = userId → plan_anterior
9. UPDATE users SET plan = nuevo_plan_slug WHERE id = userId
10. INSERT billing.billing_events { ... }
11. AWAIT redis.del('plan:' + userId)
12. Si plan_anterior !== nuevo_plan_slug:
    a. Si orden(nuevo) > orden(anterior) → email "Has pasado a plan X (upgrade)"
    b. Si orden(nuevo) < orden(anterior) → email "Has pasado al plan X (downgrade)"
13. INSERT audit_log (action=PLAN_UPDATED)
```

**Tablas:** `billing.subscriptions`, `users`, `billing.billing_events`, `audit_log`
**Notificación:** Email cambio de plan + notificación in-app

---

### Evento: `customer.subscription.deleted`

**Pseudocódigo:**
```
1. Verificar idempotencia
2. sub = event.data.object
3. userId = sub.metadata.userId
4. UPDATE billing.subscriptions SET
     status = 'canceled',
     cancel_at_period_end = false
   WHERE user_id = userId
5. UPDATE users SET plan = 'free' WHERE id = userId
6. SELECT invoices_count, ocr_count FROM billing.usage_tracking
   WHERE user_id = userId AND period_month = format(NOW(), 'YYYY-MM')
   -- Si excede límites FREE: loggear exceso, el PlanGuard bloqueará nuevas acciones
7. INSERT billing.billing_events { ... }
8. AWAIT redis.del('plan:' + userId)
9. Disparar email "Suscripción cancelada — offboarding útil"
10. INSERT audit_log (action=PLAN_DOWNGRADED_TO_FREE)
```

**Tablas:** `billing.subscriptions`, `users`, `billing.billing_events`, `audit_log`
**Notificación:** Email offboarding + notificación in-app

---

### Evento: `invoice.payment_succeeded`

**Pseudocódigo:**
```
1. Verificar idempotencia
2. inv = event.data.object
3. Si inv.billing_reason = 'subscription_create' → ya manejado en checkout.session.completed, retornar 200
4. SELECT id FROM users WHERE stripe_customer_id = inv.customer → userId
5. period_month = format(fromUnix(inv.period_start), 'YYYY-MM')
6. UPSERT billing.usage_tracking {
     user_id: userId,
     period_month: period_month,
     invoices_count: 0, ocr_count: 0,
     ai_queries_count: 0, email_count: 0
   } ON CONFLICT (user_id, period_month) DO NOTHING
   -- Solo inserta nuevo período; no resetea si ya existe
7. UPDATE billing.subscriptions SET
     status = 'active',
     current_period_start = fromUnix(inv.period_start),
     current_period_end = fromUnix(inv.period_end),
     at_risk = false
   WHERE user_id = userId
8. INSERT billing.billing_events { ... }
9. AWAIT redis.del('plan:' + userId)
```

**Tablas:** `billing.subscriptions`, `billing.usage_tracking`, `billing.billing_events`
**Notificación:** Ninguna (Stripe envía el recibo directamente al cliente)

---

### Evento: `invoice.payment_failed`

**Pseudocódigo:**
```
1. Verificar idempotencia
2. inv = event.data.object
3. SELECT id FROM users WHERE stripe_customer_id = inv.customer → userId
4. UPDATE billing.subscriptions SET status = 'past_due'
   WHERE user_id = userId
5. intentos_fallidos = inv.attempt_count
6. Si intentos_fallidos >= 3:
   UPDATE billing.subscriptions SET at_risk = true WHERE user_id = userId
7. INSERT billing.billing_events { ... }
8. AWAIT redis.del('plan:' + userId)
9. portal_session = stripe.billingPortal.sessions.create({ customer: inv.customer, return_url: APP_URL })
10. Disparar email "Pago fallido — actualiza tu método de pago" (con portal_session.url)
11. INSERT audit_log (action=PAYMENT_FAILED, entity_id=inv.id)
```

**Tablas:** `billing.subscriptions`, `billing.billing_events`, `audit_log`
**Notificación:** Email urgente con link al Customer Portal

---

### Evento: `customer.subscription.trial_will_end`

**Pseudocódigo:**
```
1. Verificar idempotencia
2. sub = event.data.object
3. userId = sub.metadata.userId
4. trial_end = fromUnix(sub.trial_end)
5. INSERT billing.billing_events { ... }
6. Disparar email "Tu prueba gratuita termina en 3 días"
   (incluye CTA: APP_URL/billing/checkout?plan=pro)
7. INSERT notificaciones in-app (tipo=TRIAL_ENDING)
8. INSERT audit_log (action=TRIAL_ENDING_SOON)
```

**Tablas:** `billing.billing_events`, `audit_log`
**Notificación:** Email recordatorio + notificación in-app

---

## ENTREGABLE 4 — PLANGUARD

### Hook Fastify preHandler

```typescript
// hooks/planGuard.ts

type Resource = 'invoice' | 'ocr' | 'ai_query' | 'email_inbound'

export function checkPlanLimit(resource: Resource) {
  return async function planGuardHook(request: FastifyRequest, reply: FastifyReply) {
    const userId = request.user.id

    // 1. Leer suscripción activa (cache Redis 5min)
    const cacheKey = `plan:${userId}`
    let planData = await redis.get(cacheKey)

    if (!planData) {
      const sub = await db.query(`
        SELECT p.slug, p.invoice_limit, p.ocr_limit,
               p.ai_daily_limit, p.email_limit, s.status
        FROM billing.subscriptions s
        JOIN billing.plans p ON s.plan_id = p.id
        WHERE s.user_id = $1 AND s.status IN ('active', 'trialing')
        LIMIT 1
      `, [userId])

      if (sub.rows.length === 0) {
        // Usuario en FREE (sin suscripción activa)
        planData = {
          slug: 'free', invoice_limit: 5, ocr_limit: 3,
          ai_daily_limit: 5, email_limit: 10, status: 'free'
        }
      } else {
        planData = sub.rows[0]
      }

      await redis.set(cacheKey, JSON.stringify(planData), 'EX', 300)  // TTL 5min
    } else {
      planData = JSON.parse(planData as string)
    }

    // 2. Leer usage_tracking del período actual
    const periodMonth = format(new Date(), 'yyyy-MM')
    const usage = await db.query(`
      SELECT invoices_count, ocr_count, ai_queries_count, email_count
      FROM billing.usage_tracking
      WHERE user_id = $1 AND period_month = $2
    `, [userId, periodMonth])

    const currentUsage = usage.rows[0] ?? {
      invoices_count: 0, ocr_count: 0,
      ai_queries_count: 0, email_count: 0
    }

    // 3. Mapear resource → columnas
    const resourceMap: Record<Resource, { current: number, limit: number }> = {
      invoice:       { current: currentUsage.invoices_count, limit: planData.invoice_limit },
      ocr:           { current: currentUsage.ocr_count,      limit: planData.ocr_limit },
      ai_query:      { current: currentUsage.ai_queries_count, limit: planData.ai_daily_limit },
      email_inbound: { current: currentUsage.email_count,    limit: planData.email_limit }
    }

    const { current, limit } = resourceMap[resource]

    // 4. Comparar (-1 = ilimitado, skip check)
    if (limit !== -1 && current >= limit) {
      return reply.status(403).send({
        code: 'PLAN_LIMIT_EXCEEDED',
        resource,
        current,
        limit,
        upgradeUrl: '/billing/checkout?plan=pro'
      })
    }

    // 5. next() — continuar al handler
  }
}

// Helper: llamar tras acción exitosa en el handler
export async function incrementUsage(userId: string, resource: Resource): Promise<void> {
  const periodMonth = format(new Date(), 'yyyy-MM')
  const columnMap: Record<Resource, string> = {
    invoice:       'invoices_count',
    ocr:           'ocr_count',
    ai_query:      'ai_queries_count',
    email_inbound: 'email_count'
  }
  const col = columnMap[resource]

  await db.query(`
    INSERT INTO billing.usage_tracking (user_id, period_month, ${col})
    VALUES ($1, $2, 1)
    ON CONFLICT (user_id, period_month)
    DO UPDATE SET ${col} = billing.usage_tracking.${col} + 1,
                  updated_at = NOW()
  `, [userId, periodMonth])
}
```

### Tabla de límites por plan y recurso

| Recurso | FREE | STARTER | PRO | AGENCY |
|---------|------|---------|-----|--------|
| Facturas/mes | 5 | 30 | 150 | -1 (ilimitado) |
| OCR/mes | 3 | 20 | 100 | -1 |
| AI queries/día | 5 | 20 | -1 | -1 |
| Emails inbound/mes | 10 | 50 | -1 | -1 |
| API req/min | 100 | 300 | 600 | 1200 |

Nota: AI queries se rastrean mensualmente en `ai_queries_count`. El límite diario para FREE/STARTER se aplica usando una clave Redis adicional `ai_daily:{userId}:{YYYY-MM-DD}` con TTL 24h.

### Registro del hook en rutas Fastify

```typescript
// Invoices
fastify.post('/invoices', {
  preHandler: [JwtAuthGuard, checkPlanLimit('invoice')]
}, invoiceCreateHandler)

fastify.post('/invoices/:id/duplicate', {
  preHandler: [JwtAuthGuard, checkPlanLimit('invoice')]
}, invoiceDuplicateHandler)

// OCR
fastify.post('/ocr/upload', {
  preHandler: [JwtAuthGuard, checkPlanLimit('ocr')]
}, ocrUploadHandler)

// AI
fastify.post('/ai/chat', {
  preHandler: [JwtAuthGuard, checkPlanLimit('ai_query')]
}, aiChatHandler)

// Email inbound (en webhook Mailgun, tras verificar HMAC)
// checkPlanLimit('email_inbound') se llama programáticamente dentro del handler
```

---

## ENTREGABLE 5 — MODELO DE DATOS (schema billing)

### Migración: tabla `billing.plans`

```sql
CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE billing.plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     VARCHAR(20)    UNIQUE NOT NULL,
  name                     VARCHAR(50)    NOT NULL,
  stripe_product_id        VARCHAR(50),                          -- NULL para FREE
  invoice_limit            INTEGER        NOT NULL DEFAULT 5,    -- -1 = ilimitado
  ocr_limit                INTEGER        NOT NULL DEFAULT 3,
  ai_daily_limit           INTEGER        NOT NULL DEFAULT 5,    -- -1 = ilimitado
  email_limit              INTEGER        NOT NULL DEFAULT 10,
  price_monthly_eur        NUMERIC(10,2)  NOT NULL DEFAULT 0,
  price_annual_eur         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  stripe_price_monthly_id  VARCHAR(50),
  stripe_price_annual_id   VARCHAR(50),
  is_active                BOOLEAN        NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

INSERT INTO billing.plans
  (slug, name, invoice_limit, ocr_limit, ai_daily_limit, email_limit, price_monthly_eur, price_annual_eur)
VALUES
  ('free',    'Lefse FREE',    5,   3,   5,  10,  0.00,   0.00),
  ('starter', 'Lefse STARTER', 30,  20,  20, 50,  9.00,   86.40),
  ('pro',     'Lefse PRO',     150, 100, -1, -1,  29.00,  278.40),
  ('agency',  'Lefse AGENCY',  -1,  -1,  -1, -1,  79.00,  758.40);

-- Actualizar stripe IDs tras crear en Stripe:
-- UPDATE billing.plans SET
--   stripe_product_id = 'prod_xxx',
--   stripe_price_monthly_id = 'price_xxx',
--   stripe_price_annual_id = 'price_yyy'
-- WHERE slug = 'pro';
```

### Migración: tabla `billing.subscriptions`

```sql
CREATE TABLE billing.subscriptions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 UUID        NOT NULL REFERENCES billing.plans(id),
  stripe_subscription_id  VARCHAR(100) UNIQUE,
  stripe_customer_id      VARCHAR(100),
  status                  VARCHAR(30) NOT NULL DEFAULT 'active',
    -- active | past_due | canceled | trialing | incomplete | incomplete_expired
  billing_period          VARCHAR(10),           -- 'monthly' | 'annual'
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN     NOT NULL DEFAULT false,
  at_risk                 BOOLEAN     NOT NULL DEFAULT false,
  trial_end               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id        ON billing.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON billing.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status          ON billing.subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_sub_id   ON billing.subscriptions(stripe_subscription_id);
```

### Migración: tabla `billing.usage_tracking`

```sql
CREATE TABLE billing.usage_tracking (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_month      VARCHAR(7)  NOT NULL,   -- 'YYYY-MM'
  invoices_count    INTEGER     NOT NULL DEFAULT 0,
  ocr_count         INTEGER     NOT NULL DEFAULT 0,
  ai_queries_count  INTEGER     NOT NULL DEFAULT 0,
  email_count       INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_month)
);

CREATE INDEX idx_usage_tracking_user_period ON billing.usage_tracking(user_id, period_month);
```

### Migración: tabla `billing.billing_events` (append-only + idempotencia)

```sql
CREATE TABLE billing.billing_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id     VARCHAR(100) UNIQUE NOT NULL,
  event_type          VARCHAR(80) NOT NULL,
  user_id             UUID        REFERENCES users(id),
  stripe_customer_id  VARCHAR(100),
  payload             JSONB       NOT NULL,
  processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_events_stripe_id ON billing.billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_user_id   ON billing.billing_events(user_id);
CREATE INDEX idx_billing_events_type      ON billing.billing_events(event_type);

-- Trigger append-only
CREATE OR REPLACE FUNCTION billing.billing_events_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    RAISE EXCEPTION 'billing_events es append-only: UPDATE no permitido. ID: %', OLD.id;
  END IF;
  IF (TG_OP = 'DELETE') THEN
    RAISE EXCEPTION 'billing_events es append-only: DELETE no permitido. ID: %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER billing_events_immutable_trigger
BEFORE UPDATE OR DELETE ON billing.billing_events
FOR EACH ROW EXECUTE FUNCTION billing.billing_events_immutable();
```

### Columnas adicionales en tabla `users` (migración sobre B4)

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS plan                VARCHAR(20) NOT NULL DEFAULT 'free';

CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_plan            ON users(plan);
```

---

## ENTREGABLE 6 — FACTURACIÓN ANUAL VS MENSUAL

### Precios y ahorro

| Plan | Mensual | Anual (total) | $/mes efectivo | Ahorro |
|------|---------|---------------|----------------|--------|
| STARTER | €9.00 | €86.40 | €7.20 | €21.60/año |
| PRO | €29.00 | €278.40 | €23.20 | €69.60/año |
| AGENCY | €79.00 | €758.40 | €63.20 | €189.60/año |

### Copy UI — selector billing period

```
┌─────────────────────────────────────────────┐
│  [ Mensual ]    [ Anual  —  Ahorra 20% ]    │
└─────────────────────────────────────────────┘

STARTER
  Mensual:  €9/mes
  Anual:    €7.20/mes  ·  "Ahorras €21.60 al año"

PRO
  Mensual:  €29/mes
  Anual:    €23.20/mes  ·  "Ahorras €69.60 al año"

AGENCY
  Mensual:  €79/mes
  Anual:    €63.20/mes  ·  "Ahorras €189.60 al año"
```

### Cálculo dinámico en frontend

```typescript
const monthlyCost = planMonthlyPrice
const annualTotal = planAnnualPrice
const savingsPerYear = (monthlyCost * 12) - annualTotal
const effectiveMonthly = annualTotal / 12

// Mostrar:
// `€${effectiveMonthly.toFixed(2)}/mes`
// `Ahorras €${savingsPerYear.toFixed(2)} al año`
```

---

## ENTREGABLE 7 — EMAILS TRANSACCIONALES BILLING

### 1. Bienvenida al plan X

**Trigger:** `checkout.session.completed`
**Asunto:** `Ya eres Lefse {{plan_name}} — empieza a sellar`

```
Hola {{nombre}},

Tu plan {{plan_name}} ya está activo desde hoy.

Esto tienes este mes:
  · {{invoice_limit}} facturas con sello eIDAS
  · {{ocr_limit}} escaneos OCR
  · {{ai_limit}} consultas al asistente fiscal al día
  · {{email_limit}} emails inbound automáticos

Crea tu primera factura → {{app_url}}/invoices/new

El equipo de Lefse
```

---

### 2. Pago fallido

**Trigger:** `invoice.payment_failed`
**Asunto:** `Problema con tu pago en Lefse — actualiza tu método`

```
Hola {{nombre}},

No hemos podido cobrar tu suscripción {{plan_name}} ({{amount_eur}}€).

Tu acceso sigue activo. Stripe reintentará el cobro automáticamente.
Si el pago falla, pasarás al plan FREE.

Actualiza tu método de pago:
→ {{portal_url}}

Cualquier duda: soporte@lefse.io

El equipo de Lefse
```

---

### 3. Suscripción cancelada (offboarding)

**Trigger:** `customer.subscription.deleted`
**Asunto:** `Tu suscripción Lefse ha sido cancelada`

```
Hola {{nombre}},

Tu suscripción {{plan_name}} ha quedado cancelada.

Ahora estás en el plan FREE:
  · 5 facturas/mes
  · 3 escaneos OCR/mes
  · Todas tus facturas anteriores siguen ahí, seguras

¿Quieres volver?
→ {{checkout_url}}

¿Fue algo que hicimos mal? Cuéntanos:
→ soporte@lefse.io

El equipo de Lefse
```

---

### 4. Recordatorio fin de trial (3 días antes)

**Trigger:** `customer.subscription.trial_will_end`
**Asunto:** `Tu prueba Lefse termina el {{trial_end_date}}`

```
Hola {{nombre}},

Tu período de prueba de Lefse {{plan_name}} termina el {{trial_end_date}}.

Si tienes método de pago configurado, seguirás con {{plan_name}} automáticamente.
Si no, pasarás al plan FREE.

Gestiona tu suscripción:
→ {{portal_url}}

El equipo de Lefse
```

---

### 5. Downgrade ejecutado

**Trigger:** `customer.subscription.updated` cuando nuevo plan < plan anterior
**Asunto:** `Has pasado al plan {{new_plan_name}} en Lefse`

```
Hola {{nombre}},

Tu plan ha cambiado de {{old_plan_name}} a {{new_plan_name}}.

Tus nuevos límites desde hoy:
  · {{invoice_limit}} facturas/mes
  · {{ocr_limit}} escaneos OCR/mes
  · {{ai_limit}} consultas al asistente fiscal

Tus datos existentes están a salvo — solo se bloquean nuevas
acciones hasta que estés dentro del límite.

¿Quieres recuperar tu plan anterior?
→ {{checkout_url}}

El equipo de Lefse
```

---

## ENTREGABLE 8 — .env.example (variables nuevas billing B6)

```bash
# ─────────────────────────────────────────────────────────
# BILLING — Stripe (B6) — añadir a .env.example existente
# ─────────────────────────────────────────────────────────

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs — STARTER
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...

# Stripe Price IDs — PRO
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...

# Stripe Price IDs — AGENCY
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_ANNUAL=price_...

# Stripe Coupon
STRIPE_COUPON_ANNUAL=ANNUAL_20

# URLs billing
BILLING_SUCCESS_URL=https://app.lefse.io/dashboard?upgrade=success
BILLING_CANCEL_URL=https://app.lefse.io/pricing
BILLING_PORTAL_RETURN_URL=https://app.lefse.io/dashboard
```

---

## MAPA DE DEPENDENCIAS B6

```
users.stripe_customer_id  ←→  Stripe Customer
billing.plans             ←→  Stripe Products + Prices
billing.subscriptions     ←→  Stripe Subscriptions
billing.usage_tracking    ←   PlanGuard (read) + handlers (incrementUsage)
billing.billing_events    ←   POST /webhooks/stripe (append-only, idempotencia)
Redis plan:{userId}       ←→  PlanGuard cache (TTL 5min, invalidar en webhook)
```

## FLUJO COMPLETO UPGRADE

```
Usuario → /pricing → click "Pasarme a PRO"
  → POST /billing/checkout { plan_slug: 'pro', billing_period: 'monthly' }
  → Crear/recuperar Stripe Customer
  → Crear Checkout Session (automatic_tax, allow_promotion_codes, tax_id_collection)
  → Redirect a checkout.stripe.com
  → Usuario introduce tarjeta + NIF fiscal
  → Stripe Tax calcula IVA 21% ES automáticamente
  → Pago autorizado → Stripe emite checkout.session.completed
  → POST /webhooks/stripe → verificar firma + idempotencia
  → Handler: UPSERT subscriptions, UPDATE users.plan='pro'
  → UPSERT usage_tracking período actual
  → Invalidar Redis plan:{userId}
  → Email bienvenida plan PRO
  → Redirect APP_URL/dashboard?upgrade=success
```

---

_B6 completado. Siguiente bloque desbloqueado: B8 (ToS + RGPD)._
