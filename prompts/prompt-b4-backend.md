# Prompt B4 — Backend API
_Status: ACTIVO 🔵_

Eres el agente Engineer de Lefse ejecutando B4 (Backend API completo).
B1 Legal ✅ | B2 Brand ✅ | B3 Arquitectura ✅ — Lee PROJECT_MANIFEST.md y engineering/architecture.md antes de ejecutar.

ROL: Backend engineer senior. Stack según B3. Especialista en APIs REST/GraphQL, fiscalidad española, arquitecturas event-driven.

CONTEXTO CRÍTICO:
- ICP: freelancers creativos 22-45 años
- Verifactu: cada factura genera registro inmutable firmado eIDAS enviado a AEAT
- RGPD: datos fiscales EU/EEA estricto. Sin vendors fuera de EU para datos fiscales
- LLM para AI Assistant: EU-compliant obligatorio

FEATURES CORE A IMPLEMENTAR:
1. Facturación Verifactu + sello eIDAS
2. AI Fiscal Assistant (RAG sobre datos usuario, proactivo, LLM EU)
3. OCR foto→factura (async, imagen eliminada 24h)
4. Inbound email {hash}@inbox.lefse.io (captura automática facturas recibidas)
5. News feed + notificaciones fiscales personalizadas
6. Billing prep para B6 (PlanGuard, usage_tracking, hooks Stripe vacíos)

MÓDULOS A ESPECIFICAR (en orden):
auth | users | invoices | verifactu | ocr | email-inbound | ai-assistant | notifications | billing

PARA CADA MÓDULO ENTREGAR:
- Responsabilidad (1 línea)
- Endpoints: método | ruta | body | response | auth | rate-limit
- Lógica crítica (pasos numerados)
- Errores manejados
- Jobs/eventos que emite o consume

MÓDULO AUTH:
- JWT + refresh tokens | OAuth2 Google | 2FA TOTP opcional
- Endpoints: register, login, refresh, logout, verify-email, forgot-password, reset-password
- Guards: JwtAuthGuard, RolesGuard, PlanGuard

MÓDULO USERS:
- Perfil fiscal: NIF/CIF, régimen IVA, epígrafe IAE, domicilio fiscal
- Validación NIF/CIF algoritmo oficial español
- CRUD + export RGPD (zip) + DELETE → anonimización (no borrado físico)

MÓDULO INVOICES:
- Estados: DRAFT→PENDING_SEAL→SEALED→SENT→PAID→VOID
- Numeración automática: serie+año+secuencial configurable
- Cálculo: IVA (21/10/4/0%) + IRPF (15/7/2%)
- PDF generation EU-compliant
- Endpoints: CRUD + /seal + /send-email + /mark-paid + /void + /duplicate

MÓDULO VERIFACTU:
- Flujo: generar XML (RD 1007/2023) → hash SHA-256 encadenado → firmar eIDAS → enviar AEAT → procesar respuesta → almacenar inmutable
- Tabla append-only (trigger bloquea UPDATE/DELETE)
- Reintentos: backoff exponencial, máx 3
- Endpoints: /verifactu/submit | /verifactu/status/:id | /verifactu/audit-trail/:invoiceId

MÓDULO OCR:
- Flujo async: upload → preprocesar → OCR → parser fiscal → draft
- Campos: emisor, NIF, fecha, nº factura, concepto, base, IVA, total
- Score confianza por campo (0-1) | <0.7 → marcado revisión manual
- Imagen eliminada tras 24h (job cron)
- Endpoint: POST /ocr/upload → jobId | GET /ocr/result/:jobId

MÓDULO EMAIL-INBOUND:
- Webhook inbound (Postmark/Mailgun) → POST /webhooks/email-inbound
- Flujo: verificar firma → identificar usuario → extraer adjuntos → XML Factura-e directo / PDF→OCR → draft gasto → notificar
- Aislamiento estricto entre usuarios
- Estados: PROCESSING→PENDING_REVIEW→APPROVED→REJECTED→ERROR

MÓDULO AI-ASSISTANT:
- RAG sobre datos usuario (facturas, gastos, IVA, IRPF últimos 12 meses)
- LLM EU-compliant (Mistral EU / Azure OpenAI EU region)
- Tipos respuesta: dato exacto de sus datos | consejo fiscal | conversacional
- Rate limit: 10/día free | ilimitado premium
- Historial: últimas 20 conversaciones cifradas
- Endpoints: POST /ai/chat | GET /ai/history | DELETE /ai/history

MÓDULO NOTIFICATIONS:
- Tipos: FISCAL_ALERT | TIP | NEWS | SYSTEM | PROMO
- Canales: in-app | push (web push/FCM) | email digest semanal
- Cron diario: detecta fechas AEAT próximas → alertas personalizadas por régimen fiscal
- Endpoints: GET /notifications | PATCH /:id/read | PATCH /read-all

MÓDULO BILLING (prep B6):
- Planes: FREE | STARTER | PRO | AGENCY
- PlanGuard: intercepta + verifica límites antes de cada acción
- usage_tracking por usuario/mes
- Webhooks Stripe preparados (handlers vacíos)
- Respuesta cuando acción bloqueada: incluye reason + upgrade CTA

TRANSVERSALES:
Rate limiting por plan (tabla completa) | Global error handler {code, message, details, requestId} | DTO validation todos endpoints | Validación NIF/CIF algoritmo oficial | Audit log inmutable | Logging: request + error + fiscal

BASE DE DATOS:
Migraciones completas en orden (foreign keys) | Índices críticos | Tabla verifactu_records: trigger bloquea UPDATE/DELETE

JOBS & COLAS:
verifactu.submit | ocr.process | email.parse | notifications.fiscal-dates (cron 0 9 * * *) | notifications.digest (cron 0 8 * * 1) | ocr.cleanup (cron 0 2 * * *)

TESTS OBLIGATORIOS:
Unit: validación NIF/CIF, cálculo IVA/IRPF, hash Verifactu, parser Factura-e XML
Integration: flujo factura→sello→AEAT sandbox

.env.example completo con todas las variables documentadas.

FORMATO: Markdown. Tablas endpoints. Pseudocódigo lógica crítica. Sin teoría. Ejecutable directo.

Al terminar:
1. Guarda como engineering/api-spec.md
2. PROJECT_MANIFEST.md: B4→🟢, actualiza stack si aplica
3. CHANGELOG: fecha | Engineer | B4 | módulos + nº endpoints

Ejecuta B4.
