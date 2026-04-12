# Prompt B5 — Wireframes + Design System
_Status: LISTO ⚪_

Eres el agente Brand/Engineer de Lefse ejecutando B5 (sistema de diseño + wireframes).
B2 ✅ | B3 ✅ — Lee PROJECT_MANIFEST.md y brand/brand-book.md antes de ejecutar.

ROL: Product designer senior + frontend architect. SaaS dashboards, design systems, mobile-first.

CONTEXTO:
- ICP: freelancers creativos 22-45 años
- Sensación: atracción inmediata (wow) + confianza + comunidad
- Referentes: SSSTUFFF · NUDE PROJECT · EME Studios — finanzas atractivas, no corporativas
- Color primario: #FF4D00 | Display: Syne 700 | Cuerpo: Inter 400 | Mono: JetBrains Mono
- Dark/Light mode obligatorio
- Features a wireframear: dashboard, factura, AI chat, OCR mobile, inbound email, news feed, onboarding, settings/billing

ENTREGABLE 1 — DESIGN TOKENS (CSS variables / Tailwind config):
Colores: primary, primary-hover, primary-subtle, bg-dark, bg-light, surface-dark, surface-light, text-primary-dark, text-primary-light, text-secondary, border-dark, border-light, success, warning, error
Spacing: escala base 4px (--space-1 a --space-16)
Typography: tabla (token | fuente | peso | tamaño | line-height | uso) para display-xl, display-lg, heading-md, body-lg, body-sm, mono-lg, mono-sm
Border radius: sm, md, lg, full
Shadows: card-dark, card-light, modal
Z-index: base, dropdown, modal, toast

ENTREGABLE 2 — COMPONENT LIBRARY:
Tabla (componente | variantes | estados | props clave) para:
Button | Badge (status factura) | Card | Input | InvoiceRow | AIMessage | NotifItem | SealBadge | ProgressBar | Modal | Toast | NavItem

ENTREGABLE 3 — WIREFRAMES ASCII (8 pantallas):
Cada pantalla: layout grid + jerarquía + componentes + notas responsive

1. DASHBOARD: resumen fiscal (ingresos, IVA pendiente, IRPF estimado), últimas 5 facturas, accesos rápidos (nueva factura/OCR/AI), próxima fecha AEAT, 1-2 notificaciones, KPI facturas selladas
2. CREAR/EDITAR FACTURA: campos completos, preview tiempo real, botón "Sellar y enviar", estados del sello eIDAS, guardado automático borrador
3. AI FISCAL ASSISTANT: chat full-height, sidebar resumen datos fiscales, chips pregunta frecuente, indicador "datos reales vs consejo general", disclaimer integrado, historial
4. OCR FOTO (mobile-first): flujo 3 pantallas — cámara→preview→confirmar, score confianza por campo, edición inline, estados procesando/éxito/fallo
5. INBOUND EMAIL INBOX: lista facturas recibidas, estado por item, acciones aprobar/editar/rechazar, onboarding inline con email único, estados vacío/items/error
6. NEWS FEED: feed scrolleable, filtros (todo/alertas/tips/novedades AEAT), notificaciones personalizadas destacadas, leído/no leído
7. ONBOARDING (4 pasos máx): datos fiscales → primera factura → configurar inbox email → ritual sello animado. Progress indicator visible. Skip con consecuencia visual.
8. SETTINGS/BILLING: secciones perfil fiscal/plan/pagos/notificaciones/privacidad, uso visible (X de Y facturas), CTA upgrade no agresivo, export datos + eliminar cuenta visibles

ENTREGABLE 4 — NAVEGACIÓN:
Árbol completo | Sidebar desktop colapsable | Bottom nav mobile ≤5 items | Tabla rutas: path | nombre | icono | acceso por plan

ENTREGABLE 5 — RESPONSIVE:
Tabla breakpoints (mobile <768 | tablet 768-1024 | desktop >1024 | wide >1440) con cambios de layout clave

ENTREGABLE 6 — MICRO-INTERACCIONES (10):
Tabla (trigger | animación | duración | librería) — incluir: factura sellada, ritual primera factura, AI typing, OCR procesando

ENTREGABLE 7 — ACCESIBILIDAD MÍNIMA:
Contraste AA/AAA por color | Focus states todos componentes | ARIA roles: chat, status badges, modales

FORMATO: Markdown. ASCII wireframes. Tablas specs. Sin descripción estética genérica. Ejecutable por developer sin preguntar.

Al terminar:
1. brand/design-system.md (tokens + componentes)
2. brand/wireframes.md (8 pantallas)
3. PROJECT_MANIFEST.md: B5→🟢
4. CHANGELOG: fecha | Brand | B5 | componentes + pantallas

Ejecuta B5.
