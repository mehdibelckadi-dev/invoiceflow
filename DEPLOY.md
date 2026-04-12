# Deploy — Lefse

## Servicios necesarios

| Servicio | Para qué | Coste estimado |
|---|---|---|
| Railway | API + Web (EU Frankfurt) | ~$13/mes total |
| Railway PostgreSQL | DB con pgvector | incluido |
| Railway Redis | BullMQ + cache | incluido |
| Stripe | Billing | 1.4% + 0.25€/tx |
| Mailgun EU | Email inbound + transaccional | $0-35/mes |
| Mistral AI | Embeddings + chat | pay as you go |
| Mindee | OCR facturas | 500 páginas gratis |
| Cloudflare R2 | OCR temporal (24h RGPD) | $0 (10GB gratis) |
| Uanataca | Firma eIDAS Verifactu | contactar QTSP |

---

## PASO 1 — GitHub

```bash
git add .
git commit -m "feat: lefse monorepo v1"
git remote add origin https://github.com/TU_USUARIO/lefse.git
git push -u origin main
```

---

## PASO 2 — Railway — Servicio API

1. railway.app → New Project → GitHub repo
2. Nombre: `lefse-api` · Root directory: `/`
3. Railway detecta `railway.toml` automáticamente

**Variables requeridas:**

```
NODE_ENV=production
PORT=3001
APP_URL=https://TU_WEB.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

JWT_SECRET=           # openssl rand -hex 32
JWT_REFRESH_SECRET=   # openssl rand -hex 32
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

UANATACA_API_URL=https://api.uanataca.com
UANATACA_API_KEY=
UANATACA_CERTIFICATE_ID=

AEAT_ENV=sandbox
AEAT_VERIFACTU_URL_SANDBOX=https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SuministroInformacion
AEAT_VERIFACTU_URL_PROD=https://www1.aeat.es/wlpl/TIKE-CONT/ws/SuministroInformacion

MINDEE_API_KEY=
MINDEE_API_URL=https://api.mindee.net

MISTRAL_API_KEY=
MISTRAL_API_URL=https://api.mistral.ai

MAILGUN_API_KEY=
MAILGUN_DOMAIN=inbox.lefse.io
MAILGUN_WEBHOOK_SIGNING_KEY=
MAILGUN_API_URL=https://api.eu.mailgun.net

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=lefse-ocr
R2_PUBLIC_URL=https://pub-xxx.r2.dev

STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
BILLING_SUCCESS_URL=https://TU_WEB.up.railway.app/billing/success
BILLING_CANCEL_URL=https://TU_WEB.up.railway.app/billing
BILLING_PORTAL_RETURN_URL=https://TU_WEB.up.railway.app/billing

RESEND_API_KEY=re_...
RESEND_FROM=Lefse <noreply@lefse.io>
```

---

## PASO 3 — Railway — PostgreSQL + migraciones

1. Proyecto Railway → + New → Database → PostgreSQL
2. La variable `${{Postgres.DATABASE_URL}}` se inyecta sola

Correr migraciones desde local:

```bash
# Instalar pgvector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Ejecutar todas las migraciones en orden
for f in packages/db/src/migrations/*.sql; do
  psql $DATABASE_URL -f "$f" && echo "✓ $f"
done
```

---

## PASO 4 — Railway — Redis

1. Proyecto Railway → + New → Database → Redis
2. `${{Redis.REDIS_URL}}` se inyecta automáticamente

---

## PASO 5 — Railway — Servicio Web (Next.js)

1. + New → GitHub Repo → mismo repo
2. Nombre: `lefse-web` · Root directory: `apps/web`
3. Usa `apps/web/railway.toml`

**Variables Web:**

```
NEXT_PUBLIC_API_URL=https://TU_API.up.railway.app
NODE_ENV=production
```

---

## PASO 6 — Stripe — Crear productos

1. stripe.com → Products → + Add product

| Plan | Precio/mes | Precio/año |
|---|---|---|
| Lefse STARTER | 9.00 € | 86.40 € |
| Lefse PRO | 29.00 € | 278.40 € |
| Lefse AGENCY | 79.00 € | 758.40 € |

2. Actualizar Price IDs en DB:

```sql
UPDATE billing.plans SET
  stripe_product_id      = 'prod_xxx',
  stripe_price_monthly_id = 'price_xxx',
  stripe_price_annual_id  = 'price_yyy'
WHERE slug = 'starter';
-- repetir para pro y agency
```

3. Webhook → `https://TU_API.up.railway.app/webhooks/stripe`

   Eventos:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`

---

## PASO 7 — Mailgun — Inbound routing

1. mailgun.com → Domains → Add: `inbox.lefse.io` (EU region)
2. Configurar DNS MX según instrucciones Mailgun
3. Inbound Routes → + Create Route:
   - Match: `match_recipient(".*@inbox.lefse.io")`
   - Forward: `https://TU_API.up.railway.app/webhooks/email-inbound/webhook`
4. Copiar Webhook Signing Key → `MAILGUN_WEBHOOK_SIGNING_KEY`

---

## PASO 8 — Verificar

```bash
curl https://TU_API.up.railway.app/health
# {"status":"ok","ts":"...","env":"production"}
```

---

## Generar secrets

```bash
openssl rand -hex 32   # para JWT_SECRET
openssl rand -hex 32   # para JWT_REFRESH_SECRET
```

---

## Comandos Railway CLI

```bash
railway logs --tail          # logs en tiempo real
railway up                   # redeploy manual
railway open                 # abrir URL en browser
railway run -- psql $DATABASE_URL   # shell DB
```
