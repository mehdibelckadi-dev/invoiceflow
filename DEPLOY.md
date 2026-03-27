# 🚀 Guía de despliegue — InvoiceFlow

Tiempo estimado: **45-60 minutos** la primera vez.

---

## Antes de empezar — cuentas que necesitas

Créalas ahora si no las tienes (todas tienen plan gratuito para empezar):

| Servicio | Para qué | URL |
|---|---|---|
| GitHub | Alojar el código | github.com |
| Railway | Servidor (deploy) | railway.app |
| Clerk | Login de usuarios | clerk.com |
| Stripe | Cobros | stripe.com |
| Anthropic | IA (Claude) | console.anthropic.com |
| Postmark *(opcional)* | Email inbound | postmarkapp.com |
| Resend *(opcional)* | Email de solicitudes | resend.com |

---

## PASO 1 — Subir código a GitHub

```bash
cd invoiceflow

git init
git add .
git commit -m "Initial commit — InvoiceFlow v1"

# Crea un repo en github.com (botón + → New repository)
# Llámalo: invoiceflow (privado recomendado al principio)

git remote add origin https://github.com/TU_USUARIO/invoiceflow.git
git branch -M main
git push -u origin main
```

✅ Verifica que en github.com/TU_USUARIO/invoiceflow aparecen los archivos.

---

## PASO 2 — Crear proyecto en Railway

1. Ve a **railway.app** → Log in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Selecciona el repo `invoiceflow`
4. Railway detectará `railway.toml` y empezará a construir
5. Espera ~3 minutos a que el build termine (verde = ok)

**Añadir volumen persistente para la base de datos:**
1. En tu proyecto Railway → click en el servicio
2. Pestaña **Volumes** → **+ Add Volume**
3. Mount path: `/data`
4. Esto garantiza que la DB no se borra entre deploys

**Obtener tu URL:**
Settings → Domains → **Generate Domain**
Tendrás algo como: `invoiceflow-production.up.railway.app`

---

## PASO 3 — Configurar Clerk (autenticación)

1. Ve a **clerk.com** → Create application
2. Nombre: "InvoiceFlow" · Activa: Email, Google
3. Dashboard → API Keys → copia:
   - `CLERK_PUBLISHABLE_KEY` (empieza con `pk_live_` o `pk_test_`)
   - `CLERK_SECRET_KEY` (empieza con `sk_live_` o `sk_test_`)

4. **Production domains** (cuando tengas URL de Railway):
   - Settings → Domains → Add domain: `tu-app.up.railway.app`

5. **Redirect URLs** (importante):
   - Allowed redirect URLs: `https://tu-app.up.railway.app/*`
   - Sign-in URL: `/login`
   - After sign-in: `/`

---

## PASO 4 — Configurar Stripe (pagos)

### Crear productos

1. **stripe.com** → Dashboard → Products → + Add product

**Producto 1: Starter**
- Name: Starter
- Price: 9,00 € · Recurring · Monthly
- Copia el Price ID: `price_xxxx` → lo necesitarás

**Producto 2: Pro**
- Name: Pro
- Price: 19,00 € · Recurring · Monthly
- Copia el Price ID: `price_xxxx` → lo necesitarás

### Webhook de Stripe

1. Dashboard → Developers → Webhooks → + Add endpoint
2. Endpoint URL: `https://tu-app.up.railway.app/api/billing/webhook`
3. Events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copia el **Signing secret** (`whsec_xxxx`)

---

## PASO 5 — Variables de entorno en Railway

En Railway → tu servicio → pestaña **Variables** → añade estas:

```
# Requeridas
ANTHROPIC_API_KEY        = sk-ant-...
CLERK_PUBLISHABLE_KEY    = pk_live_...
CLERK_SECRET_KEY         = sk_live_...
STRIPE_SECRET_KEY        = sk_live_...
STRIPE_WEBHOOK_SECRET    = whsec_...
STRIPE_PRICE_STARTER     = price_...
STRIPE_PRICE_PRO         = price_...
BASE_URL                 = https://tu-app.up.railway.app

# Tu información (mejora extracción)
MY_COMPANY_NAME          = Tu Empresa
MY_TAX_ID                = B12345678

# Email inbound (opcional — configura Postmark primero)
INBOUND_EMAIL_ADDRESS    = facturas@inbound.tudominio.com
EMAIL_WEBHOOK_SECRET     = tu-token-postmark

# Resend (opcional — para solicitudes de factura)
RESEND_API_KEY           = re_...
```

Después de añadir variables → Railway hace redeploy automático.

---

## PASO 6 — Verificar que todo funciona

Abre `https://tu-app.up.railway.app/health` → debe devolver:
```json
{"status": "ok", "version": "0.1.0"}
```

Abre `https://tu-app.up.railway.app/login` → debe aparecer el formulario de Clerk.

Crea una cuenta → sube una factura de prueba → verifica extracción.

---

## PASO 7 — Configurar Postmark (email inbound, opcional)

1. **postmarkapp.com** → crear cuenta → crear servidor
2. Settings → Inbound → Webhook URL:
   `https://tu-app.up.railway.app/api/email/inbound`
3. Añadir dominio inbound (requiere acceso DNS):
   - Añade registro MX: `inbound.tudominio.com → inbound.postmarkapp.com`
4. Copia el **Inbound webhook token** → `EMAIL_WEBHOOK_SECRET` en Railway

---

## PASO 8 — Dominio personalizado (opcional pero recomendado)

1. Compra un dominio en **Namecheap** o **Cloudflare** (~10€/año)
   Sugerencia: `invoiceflow.es` o `misfacturas.app`

2. Railway → Settings → Domains → Custom domain
3. Añade el dominio y sigue las instrucciones de DNS
4. Actualiza `BASE_URL` en Railway con el nuevo dominio
5. Actualiza los redirect URLs en Clerk

---

## Costes mensuales estimados

| Servicio | Plan gratuito | Cuando escala |
|---|---|---|
| Railway | $5/mes (Hobby) | $0.000463/vCPU·seg |
| Clerk | Gratis hasta 10K usuarios | $25/mes (Pro) |
| Stripe | 0% hasta primer cobro | 1,4% + 0,25€/transacción |
| Anthropic | ~0,02€/factura | Pay as you go |
| Postmark | 100 emails/mes gratis | $10/mes (100K) |

**Coste total para los primeros 50 clientes: ~$15-20/mes**

---

## Resolución de problemas comunes

**Build falla en Railway:**
- Revisa los logs → busca el error específico
- Suele ser una dependencia de sistema → añade a `nixpacks.toml`

**Error 500 al abrir la app:**
- Revisa que `ANTHROPIC_API_KEY` está bien en Railway variables
- Comprueba `/health` → si falla, mira los logs del servicio

**Login no funciona:**
- Verifica que `CLERK_PUBLISHABLE_KEY` es la correcta (live vs test)
- Comprueba que el dominio está en Clerk → Production → Domains

**Stripe webhook 400:**
- El `STRIPE_WEBHOOK_SECRET` tiene que ser el del endpoint, no el de la cuenta
- Verifica que los eventos están seleccionados correctamente

---

## Comandos útiles post-deploy

```bash
# Ver logs en tiempo real
railway logs --tail

# Redeploy manual
railway up

# Abrir la app en el navegador
railway open

# Conectar a la DB (Railway shell)
railway shell
sqlite3 /data/invoiceflow/invoices.db ".tables"
```
