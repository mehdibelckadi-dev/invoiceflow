# Prompt B6 — Billing + Stripe
_Status: LISTO ⚪ — requiere B4 ✅_

Eres el agente Engineer de Lefse ejecutando B6 (Billing completo con Stripe).
B1 ✅ | B2 ✅ | B3 ✅ | B4 ✅ — Lee PROJECT_MANIFEST.md y engineering/api-spec.md antes de ejecutar.

ROL: Backend engineer senior. Especialista en SaaS billing, Stripe, modelos freemium/usage-based.

CONTEXTO:
- Stack: Fastify 5 + Node.js 22 | PostgreSQL (schema billing) | Railway EU Frankfurt
- B4 ya tiene: PlanGuard hook, usage_tracking tabla, webhooks Stripe vacíos, esquema planes FREE/STARTER/PRO/AGENCY
- Stripe como procesador de pagos (ya decidido en B3)
- RGPD: datos de pago gestionados 100% por Stripe (PCI DSS delegado); nunca almacenar datos tarjeta

## PLANES A DEFINIR

| Plan | Precio | Facturas/mes | OCR/mes | AI queries/día | Inbound emails | Sello eIDAS |
|------|--------|-------------|---------|----------------|----------------|-------------|
| FREE | €0 | 5 | 3 | 5 | 10 | ✅ (incluido) |
| STARTER | €9/mes | 30 | 20 | 20 | 50 | ✅ |
| PRO | €29/mes | 150 | 100 | ilimitado | ilimitado | ✅ |
| AGENCY | €79/mes | ilimitado | ilimitado | ilimitado | ilimitado | ✅ + multi-workspace |

_Ajustar precios si el análisis de mercado/costes lo justifica. Razonar brevemente._

## ENTREGABLE 1 — PRODUCTOS Y PRECIOS EN STRIPE

- Crear estructura Stripe: Products + Prices (mensual + anual con -20%)
- Price IDs necesarios por plan × periodicidad
- Stripe Tax activado (IVA español automático)
- Metadata en cada Price: plan_slug, invoice_limit, ocr_limit, ai_limit, email_limit

## ENTREGABLE 2 — CHECKOUT Y PORTAL

Endpoints (completar los stubs de B4):

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /billing/checkout | Crear Stripe Checkout Session |
| POST | /billing/portal | Crear Customer Portal Session |
| GET | /billing/subscription | Estado actual suscripción |
| GET | /billing/usage | Uso actual del período |
| GET | /billing/invoices | Historial facturas Stripe |

Lógica /billing/checkout:
1. Verificar usuario autenticado
2. Crear/recuperar Stripe Customer (stripe_customer_id en users)
3. Crear Checkout Session (mode: subscription, allow_promotion_codes: true)
4. success_url + cancel_url
5. Pasar metadata: userId, plan_slug

## ENTREGABLE 3 — WEBHOOKS STRIPE (completar handlers vacíos de B4)

POST /webhooks/stripe — verificar firma Stripe-Signature

Eventos a manejar:
- `checkout.session.completed` → activar plan, INSERT subscriptions, reset usage
- `customer.subscription.updated` → actualizar plan, límites
- `customer.subscription.deleted` → downgrade a FREE
- `invoice.payment_succeeded` → registrar pago, reset usage mensual
- `invoice.payment_failed` → marcar subscription at_risk, notificar usuario
- `customer.subscription.trial_will_end` → notificación 3 días antes

Para cada evento:
- Pseudocódigo (pasos numerados)
- Qué tablas actualiza
- Qué notificación dispara

## ENTREGABLE 4 — PLANGUARD (refinar el de B4)

PlanGuard como Fastify preHandler hook:

```
checkPlanLimit(resource: 'invoice' | 'ocr' | 'ai_query' | 'email_inbound')
→ leer subscription activa del usuario (cache Redis 5min)
→ leer usage_tracking del período actual
→ comparar contra límite del plan
→ si excede: return 403 { code: "PLAN_LIMIT_EXCEEDED", resource, current, limit, upgradeUrl: "/billing/checkout?plan=pro" }
→ si ok: next()
→ tras acción exitosa: INCREMENT usage_tracking (upsert)
```

Tabla rate limits completa por plan y recurso.

## ENTREGABLE 5 — MODELO DE DATOS (schema billing)

Migraciones SQL (completar las de B4):
- `plans` — slug, name, stripe_product_id, invoice_limit, ocr_limit, ai_daily_limit, email_limit, price_monthly_eur, price_annual_eur, stripe_price_monthly_id, stripe_price_annual_id
- `subscriptions` — user_id UNIQUE, plan_id, stripe_subscription_id, stripe_customer_id, status (active/past_due/canceled/trialing), current_period_start, current_period_end, cancel_at_period_end
- `usage_tracking` — user_id, period_month (YYYY-MM), invoices_count, ocr_count, ai_queries_count, email_count — UNIQUE(user_id, period_month)
- `billing_events` — append-only log de todos los eventos Stripe procesados (idempotencia)

Idempotencia: antes de procesar webhook, verificar stripe_event_id no existe en billing_events.

## ENTREGABLE 6 — PRUEBA ANUAL VS MENSUAL

- Descuento anual: -20% (mostrar ahorro en €/año)
- Coupon Stripe para descuento anual
- UI copy: "Ahorra €X al año"

## ENTREGABLE 7 — EMAILS TRANSACCIONALES BILLING

Triggers y plantilla (asunto + cuerpo breve):
- Bienvenida al plan X
- Pago fallido (con link portal)
- Suscripción cancelada (offboarding útil)
- Recordatorio 3 días antes fin trial (si aplica)
- Downgrade ejecutado

## ENTREGABLE 8 — .env.example (variables billing)

Solo las nuevas no incluidas en B4.

FORMATO: Markdown. Tablas. Pseudocódigo. SQL. Sin teoría.

Al terminar:
1. Escribe en engineering/billing.md
2. PROJECT_MANIFEST.md: B6→🟢
3. CHANGELOG: fecha | Engineer | B6 | planes, webhooks, PlanGuard, migraciones

Ejecuta B6.
