# PROJECT_MANIFEST — LEFSE
_Actualizado: 2026-04-11_

## META
| Campo | Valor |
|-------|-------|
| Producto | Lefse — SaaS facturación Verifactu |
| ICP | Freelancers creativos: diseñadores, devs, marketers, influencers, youtubers — España |
| Edad ICP | 22-45 años |
| Modelo | Freemium + tiers por volumen facturas |
| Tagline | Tus facturas. Sin drama. |
| Claim | Hacienda cumplida. Tú, a lo tuyo. |
| Comunidad | Los del sello |
| Ritual | Primera factura sellada |

## BLOQUES
| ID | Nombre | Estado | Owner | Output |
|----|--------|--------|-------|--------|
| B1 | Compliance Verifactu | 🟢 | Legal | legal/compliance.md |
| B2 | Identidad de marca | 🟢 | Brand | brand/brand-book.md |
| B3 | Arquitectura técnica | 🟢 | Engineer | engineering/architecture.md |
| B4 | Backend API | 🟢 | Engineer | engineering/api-spec.md |
| B5 | Wireframes + Design System | 🟢 | Brand | brand/design-system.md |
| B6 | Billing Stripe | 🟢 | Engineer | engineering/billing.md |
| B7 | GTM + Growth | 🟢 | Growth | growth/gtm.md |
| B8 | ToS + RGPD | 🟢 | Legal | legal/tos-privacy.md |
| B9 | Launch | 🟢 | Growth | growth/launch.md |

## STACK (sync B3 🟢)
| Capa | Tech | Estado |
|------|------|--------|
| Frontend | Next.js 15 (App Router) | ✅ B3 |
| Backend/API | Fastify 5 + Node.js 22 | ✅ B3 |
| DB principal | PostgreSQL 16 | ✅ B3 |
| DB inmutable (Verifactu) | PostgreSQL schema verifactu + triggers | ✅ B3 |
| Auth | Better Auth / NextAuth v5 (EU) | ✅ B3 |
| eIDAS proveedor | Uanataca (QTSP español) | ✅ B3 |
| OCR (EU) | Mindee (Francia) | ✅ B3 |
| LLM (EU-compliant) | Mistral AI (París) | ✅ B3 |
| Vector DB (RAG) | pgvector en PostgreSQL | ✅ B3 |
| Email inbound | Mailgun EU Frankfurt | ✅ B3 |
| Cola de trabajos | BullMQ + Redis EU | ✅ B3 |
| Cloud/Hosting EU | Railway EU Frankfurt | ✅ B3 |
| Billing | Stripe | ✅ B6 |

## BRAND ESSENTIALS
| Elemento | Valor |
|----------|-------|
| Color primario | #FF4D00 |
| Tipografía display | Syne 700 |
| Tipografía cuerpo | Inter 400 |
| Tipografía mono | JetBrains Mono 500 |
| Dark mode | Obligatorio |
| Referentes | SSSTUFFF · NUDE PROJECT · EME Studios |

## LEGAL CORE (B1)
- Verifactu obligatorio autónomos/PYMEs ~oct 2026
- Registro inmutable mínimo 4 años
- Sello eIDAS cualificado por registro
- API AEAT integración directa
- Datos fiscales: soberanía EU/EEA estricta

## FEATURES CORE
1. Facturación Verifactu + sello eIDAS
2. AI Fiscal Assistant — RAG sobre datos usuario, LLM EU-compliant, proactivo
3. OCR foto → factura (pipeline async, imagen eliminada tras 24h RGPD)
4. Inbound email {userId-hash}@inbox.lefse.io — captura automática facturas recibidas
5. News feed — alertas fiscales AEAT, tips, hacks, cambios normativos
6. Dashboard KPIs fiscales en tiempo real

## DEPENDENCIAS
B4←B3 | B5←B2 | B6←B4 | B8←B1 | B9←B7+B8

## CHANGELOG
| Fecha | Agente | Bloque | Resumen |
|-------|--------|--------|---------|
| 2026-04-02 | Legal | B1 | Compliance Verifactu mapeado |
| 2026-04-02 | Brand | B2 | Identidad completa: Lefse, #FF4D00, Syne |
| 2026-04-03 | Engineer | B3 | Arquitectura + stack definidos |
| 2026-04-07 | Engineer | B4 | 9 módulos, 40+ endpoints, migraciones, jobs |
| 2026-04-07 | Brand | B5 | Design tokens, 12 componentes, 8 wireframes, nav, responsive, micro-interacciones |
| 2026-04-07 | Legal | B8 | ToS (14 arts.), Política de Privacidad RGPD, Aviso Legal, microcopy UI (8 textos), DPA template, checklist compliance RGPD operacional |
| 2026-04-07 | Engineer | B6 | Billing completo: planes FREE/STARTER/PRO/AGENCY, Stripe Products+Prices+Tax, checkout/portal/webhooks, PlanGuard, migraciones schema billing, emails transaccionales |
| 2026-04-11 | Growth | B9 | Timeline maestro (5 fases hasta oct 2026), launch day playbook hora a hora, beta cerrada 50 usuarios, assets de lanzamiento (13 piezas), landing page copy completo, secuencia email E0-E5, PR 8 medios + nota de prensa, métricas + dashboard monitorización |
