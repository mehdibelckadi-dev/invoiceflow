# Prompt B8 — ToS + RGPD
_Status: LISTO ⚪ — requiere B1 ✅_

Eres el agente Legal de Lefse ejecutando B8 (Términos de Servicio + Política de Privacidad + compliance RGPD).
B1 ✅ — Lee PROJECT_MANIFEST.md y legal/compliance.md antes de ejecutar.

ROL: Abogado especialista en derecho digital, RGPD, fiscalidad española, SaaS B2C. Redacción jurídica clara (sin jerga innecesaria — el ICP es freelancer creativo 22-45 años).

CONTEXTO TÉCNICO CRÍTICO (afecta directamente a los textos legales):
- Stack data: PostgreSQL EU (Railway Frankfurt) | Cloudflare R2 EU | Redis EU
- Vendors con acceso a datos: Mistral AI (París, EU) | Mindee (Francia, EU) | Mailgun (Frankfurt, EU) | Uanataca (España, QTSP) | Stripe (procesador pagos, PCI DSS)
- OCR: imagen original eliminada tras 24h (cron automático)
- Email inbound: {hash}@inbox.lefse.io — facturas de terceros procesadas automáticamente
- Verifactu: registros fiscales con obligación legal de retención mínima 4 años (no sujetos a derecho al olvido)
- Derecho al olvido: anonimización (no borrado físico) de datos no fiscales; imposible borrar verifactu_records por obligación legal
- Datos de pago: gestionados 100% por Stripe — Lefse no almacena datos tarjeta
- AI Assistant: procesa datos fiscales reales del usuario para RAG

## ENTREGABLE 1 — TÉRMINOS DE SERVICIO

Estructura: artículos numerados, lenguaje claro pero jurídicamente sólido.

Secciones obligatorias:
1. **Partes** — Lefse (razón social, CIF, domicilio — usar placeholders [LEFSE_SOCIEDAD], [LEFSE_CIF], [LEFSE_DOMICILIO])
2. **Objeto del servicio** — descripción del SaaS, funcionalidades principales
3. **Alta y cuenta** — requisitos (autónomo/empresa española o EU), verificación NIF/CIF
4. **Planes y precios** — FREE/STARTER/PRO/AGENCY, ciclos, cambios de precio (preaviso 30 días)
5. **Facturación y pago** — Stripe como procesador, IVA aplicable, fallo de pago → grace period 7 días → downgrade FREE
6. **Obligaciones del usuario** — uso correcto, veracidad datos fiscales, no uso para fraude
7. **Obligaciones de Lefse** — disponibilidad (SLA 99.5%), notificaciones cambios, soporte
8. **Verifactu y cumplimiento fiscal** — Lefse facilita el cumplimiento pero el usuario es responsable fiscal final; disclaimer no somos asesoría fiscal
9. **AI Fiscal Assistant** — naturaleza del servicio (asistencia, no asesoría certificada), disclaimer explícito
10. **Propiedad intelectual** — Lefse retiene software; usuario retiene sus datos fiscales
11. **Suspensión y cancelación** — causas, proceso, datos tras cancelación
12. **Limitación de responsabilidad** — cap responsabilidad, exclusiones
13. **Ley aplicable y jurisdicción** — Derecho español, juzgados Madrid (o arbitraje online)
14. **Modificaciones ToS** — preaviso 30 días, aceptación implícita por uso continuado

## ENTREGABLE 2 — POLÍTICA DE PRIVACIDAD (RGPD-compliant)

Secciones obligatorias (Art. 13 RGPD):
1. **Responsable del tratamiento** — [LEFSE_SOCIEDAD], [LEFSE_DPO_EMAIL]
2. **Datos que recogemos** — tabla exhaustiva:
   | Categoría | Datos concretos | Fuente | Base legal |
   Incluir: registro, perfil fiscal (NIF/CIF, régimen IVA, domicilio fiscal), facturas emitidas, facturas recibidas (email inbound), imágenes OCR (temporal 24h), conversaciones AI, datos de uso, datos de pago (solo referencia Stripe), logs técnicos
3. **Bases legales** — tabla: dato | base legal (consentimiento / contrato / obligación legal / interés legítimo)
4. **Finalidades del tratamiento** — para cada categoría de dato
5. **Transferencias internacionales** — tabla vendors:
   | Vendor | País | Mecanismo adecuación | Datos transferidos |
   (Mistral París EU ✅ | Mindee Francia EU ✅ | Mailgun Frankfurt EU ✅ | Uanataca España EU ✅ | Stripe: SCCs para datos mínimos de facturación | Cloudflare R2 EU ✅)
6. **Retención de datos** — tabla:
   | Tipo dato | Período retención | Razón |
   Crítico: verifactu_records → mínimo 4 años por obligación legal → no sujeto a derecho al olvido (explicar)
   Imágenes OCR → 24h automático
   Conversaciones AI → hasta eliminación cuenta + X días
7. **Derechos RGPD** — tabla: derecho | cómo ejercerlo | plazo respuesta | limitaciones
   Incluir: acceso, rectificación, supresión (con limitación por obligación fiscal), portabilidad (export zip), oposición, limitación, decisiones automatizadas
8. **Cookies** — política básica: esenciales (sesión, CSRF) + analytics (opt-in) + marketing (opt-in)
9. **Seguridad** — medidas técnicas (cifrado en tránsito TLS 1.3, en reposo, acceso mínimo, audit log)
10. **Menores** — servicio no dirigido a menores de 16 años
11. **Cambios en la política** — notificación por email con preaviso 30 días
12. **Contacto DPO** — [LEFSE_DPO_EMAIL]

## ENTREGABLE 3 — AVISO LEGAL (web)

Secciones:
- Titular del sitio web
- Propiedad intelectual
- Exención de responsabilidad contenidos externos
- Ley aplicable

## ENTREGABLE 4 — TEXTOS LEGALES UI (microcopy)

Textos listos para implementar en el producto:

1. **Checkbox registro**: "Acepto los [Términos de Servicio] y la [Política de Privacidad] de Lefse"
2. **Banner cookies**: headline + opciones (Aceptar / Solo esenciales / Configurar)
3. **Disclaimer AI Assistant**: texto inline en el chat (≤2 líneas)
4. **Disclaimer Verifactu**: texto en página de factura sellada (1 línea)
5. **Email inbound consent**: texto explicativo al activar el inbox
6. **Export datos (RGPD)**: texto botón + mensaje confirmación
7. **Eliminar cuenta**: texto botón + modal confirmación con consecuencias claras (qué se anonimiza, qué se retiene por ley)
8. **Downgrade a FREE**: mensaje con límites y datos que se conservan

## ENTREGABLE 5 — DPA (Data Processing Agreement) TEMPLATE

Template básico para cuando Lefse actúa como Encargado del Tratamiento (si un cliente empresa usa Lefse para sus empleados/autónomos):
- Objeto y duración
- Instrucciones del Responsable
- Medidas de seguridad
- Subencargados (lista vendors)
- Derechos de auditoría
- Destrucción de datos

## ENTREGABLE 6 — CHECKLIST COMPLIANCE RGPD OPERACIONAL

Lista de verificación para el equipo técnico:
- [ ] Registro de actividades de tratamiento (Art. 30) documentado
- [ ] DPA firmado con cada vendor (Mistral, Mindee, Mailgun, Uanataca, Stripe, Cloudflare)
- [ ] Proceso de respuesta a derechos RGPD (<30 días) documentado
- [ ] Cron de eliminación imágenes OCR 24h activo y monitorizado
- [ ] Trigger immutabilidad verifactu_records activo y auditado
- [ ] Backup cifrado con retención documentada
- [ ] Logging de accesos a datos fiscales
- [ ] Proceso breach notification (<72h a AEPD) documentado

FORMATO: Markdown. Lenguaje jurídico claro (no jerga excesiva). Placeholders en [MAYÚSCULAS] para datos a completar. Listo para revisar con abogado externo antes de publicar.

Al terminar:
1. Escribe en legal/tos-privacy.md
2. PROJECT_MANIFEST.md: B8→🟢
3. CHANGELOG: fecha | Legal | B8 | ToS, Privacy Policy, Aviso Legal, microcopy UI, DPA template, checklist RGPD

Ejecuta B8.
