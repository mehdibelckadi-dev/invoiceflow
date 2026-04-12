# Arquitectura Técnica — Lefse
_B3 🟢 Cerrado | 2026-04-03_

## Stack (19 capas, todo EU/EEA)

| Capa | Tecnología | Alternativa descartada | Razón |
|------|-----------|----------------------|-------|
| Frontend | Next.js 15 (App Router) | Remix | Ecosistema mayor, SSR/SSG, misma VM que API |
| Backend/API | Fastify 5 + Node.js 22 | NestJS | NestJS = overhead innecesario; misma VM que Next.js |
| DB principal | PostgreSQL 16 | MySQL / MongoDB | ACID, pgvector, JSON nativo, un solo motor |
| DB inmutable (Verifactu) | PostgreSQL schema `verifactu` + triggers RAISE EXCEPTION | Blockchain / ledger externo | Cero infra adicional; append-only garantizado |
| Auth | Better Auth / NextAuth v5 | Auth0 | Auth0 → datos a US; self-hosted EU |
| eIDAS proveedor | Uanataca (QTSP español) | Firma local | API REST moderna, HSM custodiado, clave no exportable |
| OCR (EU) | Mindee (Francia) | AWS Textract | Especializado facturas España, GDPR nativo |
| LLM (EU-compliant) | Mistral AI (París) | OpenAI / Anthropic | OpenAI/Anthropic → datos a US; Mistral EU nativo |
| Vector DB (RAG) | pgvector en PostgreSQL | Pinecone / Qdrant | Zero infra, datos colocalizados, upgrade path disponible |
| Email inbound | Mailgun EU Frankfurt | Postmark / SendGrid | Procesamiento EU, inbound routes, DPA firmado |
| Email outbound | Resend (EU region) | SendGrid | Developer-first, EU region disponible |
| Cola de trabajos | BullMQ + Redis (EU) | SQS | Self-hosted, tipado, reintentos nativos |
| Cache | Redis (Upstash EU) | Memcached | TTL, pub/sub, compatible BullMQ |
| Storage | Cloudflare R2 (EU) | S3 | Sin egress fees, GDPR, EU región |
| PDF generation | Puppeteer / pdf-lib | iText | Open source, sin licencia comercial |
| Monitoring | Sentry EU + Grafana Cloud EU | Datadog | Datos en EU, coste menor |
| CI/CD | GitHub Actions + Railway EU | Vercel | Railway EU = datos en EU, Railway compatible Fastify |
| Cloud/Hosting EU | Railway EU (Frankfurt) | Vercel / AWS | EU Frankfurt nativo, sin vendor lock-in extremo |
| Billing | Stripe | Paddle | API madura, soporte EU, webhooks robustos |

## Separación de schemas DB
```
postgres/
├── schema: public          → users, invoices, notifications, ai_conversations
├── schema: verifactu       → verifactu_records (append-only, trigger bloquea UPDATE/DELETE)
└── schema: billing         → plans, subscriptions, usage_tracking
```

## Modelo de datos (14 entidades)

| Entidad | Schema | Relaciones clave | Índices críticos |
|---------|--------|-----------------|-----------------|
| users | public | → subscriptions, invoices | email UNIQUE, nif UNIQUE |
| user_fiscal_profiles | public | users (1:1) | user_id, nif |
| invoices | public | users, invoice_items | user_id+status, numero_serie |
| invoice_items | public | invoices | invoice_id |
| verifactu_records | verifactu | invoices (1:1) | invoice_id, hash (prev_hash chain) |
| ocr_jobs | public | users, invoices | user_id+status, expires_at |
| email_inbound_items | public | users | user_id+status, received_at |
| ai_conversations | public | users | user_id, created_at DESC |
| ai_messages | public | ai_conversations | conversation_id |
| notifications | public | users | user_id+read+created_at |
| plans | billing | → subscriptions | slug UNIQUE |
| subscriptions | billing | users, plans | user_id UNIQUE, stripe_sub_id |
| usage_tracking | billing | users, plans | user_id+period UNIQUE |
| audit_log | public | users | user_id, entity_type+entity_id, created_at |

## Flujos críticos

### 1. Facturación Verifactu
```
Draft → validate → generate XML (RD 1007/2023)
→ hash SHA-256 encadenado (prev_hash)
→ firma eIDAS Uanataca (HSM)
→ POST AEAT API
→ response → INSERT verifactu_records (append-only)
→ invoice.status = SEALED
→ PDF generation → Cloudflare R2
→ notificación usuario
```

### 2. AI RAG
```
POST /ai/chat → PlanGuard (rate limit)
→ embed query (Mistral embeddings)
→ pgvector similarity search (facturas, gastos últimos 12M)
→ build context (datos reales usuario)
→ Mistral completion (EU endpoint)
→ classify: dato_exacto | consejo_fiscal | conversacional
→ INSERT ai_messages (cifrado)
→ SSE stream → cliente
```

### 3. OCR
```
POST /ocr/upload → store R2 (temp, 24h TTL)
→ BullMQ job: ocr.process
→ Mindee API → campos + score confianza (0-1)
→ parser fiscal español
→ <0.7 → marcado revisión manual
→ draft invoice pre-poblado
→ cron 02:00 → DELETE R2 objects expirados (RGPD)
```

### 4. Email Inbound
```
Mailgun webhook → POST /webhooks/email-inbound
→ verificar firma HMAC Mailgun
→ identificar usuario por {hash}@inbox.lefse.io
→ extraer adjuntos
→ XML Factura-e → parse directo
→ PDF → ocr.process job
→ draft gasto → notificar usuario
→ estado: PROCESSING→PENDING_REVIEW
```

### 5. Notificaciones Fiscales
```
cron 09:00 diario → job notifications.fiscal-dates
→ query users por régimen fiscal
→ check fechas AEAT próximas (IVA, IRPF, declaraciones)
→ generar alertas personalizadas
→ INSERT notifications
→ push web + email digest (lunes 08:00)
```

## Seguridad & Compliance (14 requisitos)

| Req | Implementación |
|-----|---------------|
| Datos fiscales EU/EEA | Todos los vendors con DPA EU firmado; ningún dato fiscal a US |
| eIDAS cualificado | Uanataca QTSP; clave HSM no exportable; certificado renovación anual |
| Inmutabilidad Verifactu | Trigger PostgreSQL RAISE EXCEPTION en UPDATE/DELETE sobre verifactu_records |
| Retención 4 años | soft-delete + policy backup; prohibido borrado físico verifactu_records |
| RGPD derecho olvido | Anonimización de datos no fiscales; NO borrado físico de registros fiscales |
| OCR imagen 24h | TTL R2 + cron cleanup 02:00; no persistir imágenes originales |
| Email inbound aislamiento | Hash userId como subdominio; validación estricta propietario en cada webhook |
| Cifrado en reposo | PostgreSQL TDE / cifrado columnas AI conversations |
| Cifrado en tránsito | TLS 1.3 obligatorio; HSTS |
| Rate limiting | Por plan (tabla en B4); Redis sliding window |
| Audit log inmutable | INSERT-only en audit_log; nunca UPDATE/DELETE |
| 2FA | TOTP opcional en onboarding; obligatorio para roles admin |
| Secrets | Variables de entorno; nunca en repo; rotación programada |
| Backup | Daily snapshot PostgreSQL → R2 cifrado; retention 30 días |

## Costes estimados

| Etapa | Coste/mes |
|-------|-----------|
| Seed (0-500 usuarios) | ~€173 |
| Growth (500-5000 usuarios) | ~€884 |

### Desglose Seed
| Servicio | €/mes |
|---------|-------|
| Railway EU (2 servicios) | 20 |
| PostgreSQL + Redis (Railway) | 25 |
| Mistral AI (estimado) | 30 |
| Uanataca eIDAS | 40 |
| Mindee OCR | 20 |
| Mailgun EU | 15 |
| Cloudflare R2 | 5 |
| Sentry EU | 18 |
| **Total** | **~173** |

## Deuda técnica aceptada

### Shortcuts aceptables
1. **pgvector en lugar de vector DB dedicado** — suficiente hasta ~50k documentos; migrar a Qdrant si latencia >500ms
2. **Railway en lugar de k8s** — gestión simplificada; migrar si necesidad de multi-región
3. **BullMQ single-node** — suficiente para Seed; Redis Cluster si colas >10k jobs/día

### Restricciones innegociables (riesgo legal cuantificado)
1. **Ningún dato fiscal fuera de EU/EEA** — multa RGPD hasta 4% facturación global o €20M
2. **Inmutabilidad verifactu_records** — alteración de registros fiscales = fraude fiscal (art. 305 CP); responsabilidad penal
3. **eIDAS QTSP obligatorio** — sello no cualificado invalida el registro Verifactu ante AEAT; sanción + rehacer todos los registros

## Desbloquea
- ✅ B4 — API Contract (prerequisito B3 satisfecho)
- ✅ B6 — Billing Stripe config (prerequisito B3 satisfecho)
