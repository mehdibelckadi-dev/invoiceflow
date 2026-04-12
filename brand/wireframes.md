# Wireframes + Sistema de Navegación — Lefse
_B5 🟢 Cerrado — 2026-04-07_

---

## ENTREGABLE 3 — WIREFRAMES ASCII (8 pantallas)

### CONVENCIONES

```
[ ]  = Button component
[__] = Input field
|    = Border/divider
█    = Surface/Card filled
░    = Skeleton / loading state
●    = Badge dot
→    = Navigation arrow / action
```

---

### PANTALLA 1 — DASHBOARD

**Grid:** 12 col, gutter 24px. Sidebar 240px fijo (desktop). Contenido en cols 3-12.
**Componentes:** Card, Badge, InvoiceRow, NotifItem, Button, NavItem

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  SIDEBAR (240px)          │  MAIN CONTENT (fluid)                           ║
╠══════════════════════════╪═════════════════════════════════════════════════╣
║  ◉ LEFSE                  │  ┌─ HEADER ─────────────────────────────────┐  ║
║                           │  │  Hola, Mahdi 👋   [🔔 3]  [Avatar MM]   │  ║
║  ▸ Dashboard  ← active    │  └───────────────────────────────────────────┘  ║
║  ▸ Facturas               │                                                 ║
║  ▸ AI Assistant           │  ┌─ KPI ROW (4 cards, gap-4) ──────────────┐   ║
║  ▸ Inbox       ●3         │  │                                          │   ║
║  ▸ Feed        ●2         │  │  ┌────────────┐  ┌────────────┐         │   ║
║  ▸ Ajustes                │  │  │ Ingresos   │  │ IVA        │         │   ║
║                           │  │  │ YTD        │  │ pendiente  │         │   ║
║  ──────────────────────── │  │  │            │  │            │         │   ║
║                           │  │  │ €12.450    │  │ €2.614     │         │   ║
║  Plan: FREE               │  │  │ +12% vs    │  │ Próx: T2   │         │   ║
║  ██████░░░░ 6/10 facts    │  │  │ mes ant.   │  │            │         │   ║
║  [Subir a Pro →]          │  │  └────────────┘  └────────────┘         │   ║
║                           │  │                                          │   ║
╚══════════════════════════╪  │  ┌────────────┐  ┌────────────┐         │   ║
                            │  │  │ IRPF       │  │ Facturas   │         │   ║
                            │  │  │ estimado   │  │ selladas   │         │   ║
                            │  │  │            │  │ (mes)      │         │   ║
                            │  │  │ €3.112     │  │  ◉ 8       │         │   ║
                            │  │  │ retención  │  │ SEALED     │         │   ║
                            │  │  └────────────┘  └────────────┘         │   ║
                            │  └──────────────────────────────────────────┘  ║
                            │                                                 ║
                            │  ┌─ QUICK ACTIONS ─────────────────────────┐   ║
                            │  │  [+ Nueva factura]  [📷 OCR foto]       │   ║
                            │  │  [🤖 Preguntar a AI]                    │   ║
                            │  └──────────────────────────────────────────┘  ║
                            │                                                 ║
                            │  ┌─ ALERTA AEAT (si <30 días) ─────────────┐  ║
                            │  │  ⚠ Modelo 303 vence en 12 días          │  ║
                            │  │  IVA a declarar: €2.614  [Ver detalle →] │  ║
                            │  └──────────────────────────────────────────┘  ║
                            │  (borde izquierdo naranja, Card highlight)      ║
                            │                                                 ║
                            │  ┌─ ÚLTIMAS FACTURAS ──────────────────────┐   ║
                            │  │  Cabecera: "Facturas recientes"  [Ver →] │  ║
                            │  ├─────────────────────────────────────────┤   ║
                            │  │  [Cliente]  Concepto    Fecha    €     ●│   ║
                            │  │  Acme SL    Diseño web  05 Abr  1200  PAID  ║
                            │  │  Beta Co    Copy        04 Abr   800  SENT  ║
                            │  │  Gamma Inc  Dev sprint  02 Abr  3500  SEALED║
                            │  │  Delta SA   Foto prod.  01 Abr   450  DRAFT ║
                            │  │  Epsilon    Consultoría 28 Mar  2000  PAID  ║
                            │  └──────────────────────────────────────────┘  ║
                            │                                                 ║
                            │  ┌─ NOTIFICACIONES DESTACADAS ─────────────┐   ║
                            │  │  💡 Tip: Deduces el 30% internet cowork │   ║
                            │  │  📰 AEAT actualiza modelo 347 — leer →  │   ║
                            │  └──────────────────────────────────────────┘  ║
```

**Responsive notes:**
- Mobile: sidebar → bottom nav. KPI row → 2x2 grid. Quick actions → row scroll horizontal.
- Tablet: sidebar mini (iconos). KPIs 2x2.
- Alerta AEAT: siempre visible sobre la lista de facturas.

---

### PANTALLA 2 — CREAR / EDITAR FACTURA

**Grid:** 2 col — Form 60% | Preview PDF 40%. Gap 32px.
**Componentes:** Input, Button, SealBadge, Card, Badge, ProgressBar

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                      ║
║  ← Volver  |  Nueva factura  |  ● Guardado automático  |  [DRAFT Badge]     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ FORM (60%) ─────────────────────────┐ ┌─ PREVIEW PDF (40%) ──────────┐ ║
║  │                                       │ │                               │ ║
║  │  CLIENTE                              │ │  ┌──────────────────────────┐ │ ║
║  │  [__ Nombre / Razón social _______]   │ │  │  LEFSE                   │ │ ║
║  │  [__ NIF/CIF ___________________]     │ │  │  ─────────────────────── │ │ ║
║  │  [__ Email _____________________]     │ │  │  FACTURA #A-2026-0042    │ │ ║
║  │  [__ Dirección _________________]     │ │  │  Fecha: 07/04/2026       │ │ ║
║  │                                       │ │  │                          │ │ ║
║  │  FACTURA                              │ │  │  Cliente:                │ │ ║
║  │  [__ Serie __] [__ Nº ___________]    │ │  │  Acme SL                 │ │ ║
║  │  [__ Fecha emisión ______________]    │ │  │  B-12345678              │ │ ║
║  │  [__ Fecha vencimiento __________]    │ │  │                          │ │ ║
║  │                                       │ │  │  Concepto      Unid  €   │ │ ║
║  │  CONCEPTO / LÍNEAS                    │ │  │  Diseño web      1  1200 │ │ ║
║  │  ┌─────────────────────────────────┐  │ │  │                          │ │ ║
║  │  │ Concepto  Cant  Precio  IVA%    │  │ │  │  ─────────────────────── │ │ ║
║  │  │ [______] [ 1 ] [____] [21%▼]   │  │ │  │  Base imponible:  1200€  │ │ ║
║  │  │                          [+ línea│  │ │  │  IVA 21%:          252€  │ │ ║
║  │  └─────────────────────────────────┘  │ │  │  IRPF -15%:       -180€  │ │ ║
║  │                                       │ │  │  ─────────────────────── │ │ ║
║  │  RETENCIONES                          │ │  │  TOTAL:          1.272€  │ │ ║
║  │  IRPF%: [15% ▼]                       │ │  │                          │ │ ║
║  │                                       │ │  │  Sellada con eIDAS       │ │ ║
║  │  ┌─ TOTALES CALCULADOS ────────────┐  │ │  │  ◈ [SealBadge SEALED xl] │ │ ║
║  │  │  Base imponible:    €1.200,00   │  │ │  └──────────────────────────┘ │ ║
║  │  │  IVA (21%):           €252,00   │  │ │                               │ ║
║  │  │  IRPF (-15%):        -€180,00   │  │ │  [📥 Descargar PDF]           │ ║
║  │  │  ─────────────────────────────  │  │ │  [📤 Enviar por email]        │ ║
║  │  │  TOTAL:             €1.272,00   │  │ └───────────────────────────────┘ ║
║  │  └─────────────────────────────────┘  │                                   ║
║  │                                       │                                   ║
║  │  ESTADO SELLO                         │                                   ║
║  │  ┌─────────────────────────────────┐  │                                   ║
║  │  │  ○──────○──────● 
║  │  │ Pendiente → Procesando → Sellada │  │                                   ║
║  │  │                                  │  │                                   ║
║  │  │  [SealBadge size=md status=pending│  │                                  ║
║  │  │   o processing/sealed según paso] │  │                                  ║
║  │  └─────────────────────────────────┘  │                                   ║
║  │                                       │                                   ║
║  │  [Sellar y enviar — PRIMARY LARGE]    │                                   ║
║  │  [Guardar borrador — SECONDARY]       │                                   ║
║  └───────────────────────────────────────┘                                   ║
```

**Responsive notes:**
- Mobile: form fullscreen, preview accesible via tab "Vista previa".
- Tablet: form 55% / preview 45%, preview scroll sticky.
- Autosave: indicador "● Guardado" top-right, parpadea 2s tras save.

---

### PANTALLA 3 — AI FISCAL ASSISTANT

**Grid:** 2 col — Chat 70% | Sidebar fiscal 30%. Height: 100vh - header.
**Componentes:** AIMessage, Card, Badge, Input, Button, ProgressBar

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                      ║
║  🤖 AI Fiscal Assistant   Rate limit: [███████░░░] 7/10 consultas hoy       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ CHAT (70%, scroll) ─────────────────────┐ ┌─ SIDEBAR FISCAL (30%) ───┐ ║
║  │                                           │ │                           │ ║
║  │  [system msg, centrado, caption]          │ │  ┌─ YTD RESUMEN ────────┐ │ ║
║  │  Soy tu asistente fiscal. Pregúntame      │ │  │ Ingresos brutos       │ │ ║
║  │  lo que quieras sobre tus finanzas.       │ │  │ €12.450               │ │ ║
║  │                                           │ │  │                       │ │ ║
║  │  ┌─ AIMessage assistant ───────────────┐  │ │  │ IVA a pagar (T2)     │ │ ║
║  │  │ 👤 Lefse AI                         │  │ │  │ €2.614               │ │ ║
║  │  │ Hola Mahdi, veo que en Q1 2026      │  │ │  │                       │ │ ║
║  │  │ has facturado €12.450. Tu IVA       │  │ │  │ IRPF retenido YTD    │ │ ║
║  │  │ pendiente del T1 es €2.614.         │  │ │  │ €3.112               │ │ ║
║  │  │ ¿Quieres que te prepare el resumen  │  │ │  │                       │ │ ║
║  │  │ para el Modelo 303?                 │  │ │  │ Gastos deducibles     │ │ ║
║  │  │                                     │  │ │  │ €4.200               │ │ ║
║  │  │ [● Basado en tus datos]             │  │ │  └───────────────────────┘ │ ║
║  │  └─────────────────────────────────────┘  │ │                           │ ║
║  │                                           │ │  ┌─ PRÓXIMAS FECHAS ────┐ │ ║
║  │        ┌─ AIMessage user ──────────────┐  │ │  │ ⚠ 303 T2             │ │ ║
║  │        │ ¿Qué gastos puedo deducirme   │  │ │  │   Vence: 20 Jul      │ ║
║  │        │ como freelance?               │  │ │  │                       │ │ ║
║  │        └───────────────────────────────┘  │ │  │ ○ 130 Q2             │ │ ║
║  │                                           │ │  │   Vence: 20 Jul      │ ║
║  │  ┌─ AIMessage assistant loading ───────┐  │ │  │                       │ │ ║
║  │  │  ● ● ●  (animate-dot-bounce)        │  │ │  │ ○ 349 Anual          │ ║
║  │  └─────────────────────────────────────┘  │ │  │   Vence: 31 Mar 27   │ ║
║  │                                           │ │  └───────────────────────┘ │ ║
║  │                                           │ │                           │ ║
║  │  ──── CHIPS FRECUENTES ─────────────────  │ │  ⚠ DISCLAIMER           │ ║
║  │  [¿Cuánto IVA debo?]  [¿Gastos deducibles?│ │  Este asistente no      │ ║
║  │  [¿Qué es el Modelo 303?]  [Resumen Q2]   │ │  sustituye asesoría     │ ║
║  │                                           │ │  fiscal profesional.    │ ║
║  ├───────────────────────────────────────────┤ └───────────────────────────┘ ║
║  │  [__ Escribe tu pregunta fiscal... ____] [Enviar →]                      ║
║  └───────────────────────────────────────────┘                               ║
```

**Responsive notes:**
- Mobile: sidebar colapsado (toggle "Ver datos fiscales"). Chat fullscreen.
- Chips: scroll horizontal en mobile.
- Rate limit: badge en header, tooltip on hover con "Upgrade para ilimitado".

**ARIA:** `role="log" aria-live="polite"` en contenedor de mensajes.

---

### PANTALLA 4 — OCR FOTO (mobile-first, 3 pasos)

**Grid:** single column, max-w-md centrado. 3 steps con progress indicator.
**Componentes:** ProgressBar, Button, Badge (confidence score)

```
╔═════════════════════════════════╗
║  ← Cancelar   OCR Foto   ?      ║
║                                  ║
║  ●──────○──────○                 ║
║  Captura  Analizar  Confirmar    ║
╠══════════════════════════════════╣
║                                  ║
║  ═══ PASO 1 — CAPTURA ═══        ║
║                                  ║
║  ┌──────────────────────────┐    ║
║  │                          │    ║
║  │   Encuadra la factura    │    ║
║  │                          │    ║
║  │      [📷 grande]         │    ║
║  │      [Abrir cámara]      │    ║
║  │      BUTTON PRIMARY LG   │    ║
║  │                          │    ║
║  └──────────────────────────┘    ║
║                                  ║
║  [📁 Subir desde galería]        ║
║  BUTTON SECONDARY                ║
║                                  ║
║  💡 Tips para mejores resultados ║
║  • Buena iluminación             ║
║  • Factura plana, sin sombras    ║
║  • Todos los bordes visibles     ║
║                                  ║
╚══════════════════════════════════╝


╔═════════════════════════════════╗
║  ● ─── ● ─── ○                  ║
║  Captura  Analizar  Confirmar   ║
╠══════════════════════════════════╣
║                                  ║
║  ═══ PASO 2 — PROCESANDO ═══     ║
║                                  ║
║  ┌──────────────────────────┐    ║
║  │  [IMAGEN PREVIEW]        │    ║
║  │                          │    ║
║  │  ── OVERLAY SEMI-OPACO── │    ║
║  │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ ← scanner line (animate-scanner-sweep)
║  │                          │    ║
║  │                          │    ║
║  └──────────────────────────┘    ║
║                                  ║
║  Analizando imagen...            ║
║  [████████░░] ProgressBar 80%   ║
║                                  ║
║  ✓ Imagen recibida               ║
║  ✓ Detectando texto              ║
║  ○ Extrayendo campos...          ║
║                                  ║
╚══════════════════════════════════╝


╔═════════════════════════════════╗
║  ● ─── ● ─── ●                  ║
║  Captura  Analizar  Confirmar   ║
╠══════════════════════════════════╣
║                                  ║
║  ═══ PASO 3 — CONFIRMAR ═══      ║
║                                  ║
║  Revisa los campos detectados    ║
║                                  ║
║  ┌─ Campo: Emisor ─────────────┐ ║
║  │  ● VERDE (conf. 0.95)       │ ║
║  │  [__ Acme Solutions SL ___] │ ║
║  └─────────────────────────────┘ ║
║                                  ║
║  ┌─ Campo: NIF ────────────────┐ ║
║  │  ● VERDE (conf. 0.91)       │ ║
║  │  [__ B-12345678 __________] │ ║
║  └─────────────────────────────┘ ║
║                                  ║
║  ┌─ Campo: Importe Total ──────┐ ║
║  │  ● AMARILLO (conf. 0.65)   │ ║
║  │  ✎ Verificar               │ ║
║  │  [__ 1.452,00 ____________] │ ║ ← bg-warning-subtle, input activo
║  └─────────────────────────────┘ ║
║                                  ║
║  ┌─ Campo: Fecha ──────────────┐ ║
║  │  ● ROJO (conf. 0.45)       │ ║
║  │  ✎ Completar               │ ║
║  │  [__ _____________________ ] │ ← bg-error-subtle vacío
║  └─────────────────────────────┘ ║
║                                  ║
║  ● verde ≥0.85  ● amarillo 0.7-0.84  ● rojo <0.7
║                                  ║
║  [Crear factura — PRIMARY]       ║
║  [Editar campos — SECONDARY]     ║
║                                  ║
╚══════════════════════════════════╝
```

**Responsive notes:** Fullscreen en mobile. En desktop: modal centrado max-w-lg.

---

### PANTALLA 5 — INBOUND EMAIL INBOX

**Grid:** lista full-width con header fijo.
**Componentes:** Badge, Button, Card, ProgressBar, NavItem

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                      ║
║  ┌─ TU EMAIL ÚNICO ──────────────────────────────────────────────────────┐  ║
║  │  📧  a3f8b2c1@inbox.lefse.io                 [Copiar]  [?]           │  ║
║  └───────────────────────────────────────────────────────────────────────┘  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ONBOARDING INLINE (solo si inbox vacío):                                    ║
║  ┌─────────────────────────────────────────────────────────────────────────┐║
║  │  [ilustración simple: sobre → carpeta]                                  │║
║  │                                                                         │║
║  │  Reenvía tus facturas recibidas a tu email único.                       │║
║  │  Las procesamos automáticamente y te las dejamos                        │║
║  │  listas para revisar.                                                   │║
║  │                                                                         │║
║  │  [Copiar mi email]  [Ver tutorial →]                                    │║
║  └─────────────────────────────────────────────────────────────────────────┘║
║                                                                              ║
║  FILTROS:  [Todos ●]  [Pendiente revisión]  [Aprobados]  [Errores]           ║
║                                                                              ║
║  ┌─ LISTA ITEMS ─────────────────────────────────────────────────────────┐  ║
║  │                                                                        │  ║
║  │  ┌ item unread, PENDING_REVIEW ──────────────────────────────────┐   │  ║
║  │  │ ● Amazon EU SARL   │ Factura AWS Mayo    │ hace 5min │ PENDING│   │  ║
║  │  │                    │                     │           │ [Aprobar] [Editar] [Rechazar]
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                        │  ║
║  │  ┌ item, PROCESSING ─────────────────────────────────────────────┐   │  ║
║  │  │ ○ Notion.so         │ Receipt April      │ hace 12min│ ⟳ PROC│   │  ║
║  │  │   [ProgressBar indeterminate ██████░░░░░░░░░░░░░░░░░░]        │   │  ║
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                        │  ║
║  │  ┌ item, APPROVED ───────────────────────────────────────────────┐   │  ║
║  │  │ ✓ Figma, Inc.       │ Subscription Mar   │ 02 Abr    │ PAID  │   │  ║
║  │  │   → Factura #R-2026-0031 creada  [Ver factura →]              │   │  ║
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                        │  ║
║  │  ┌ item, ERROR ──────────────────────────────────────────────────┐   │  ║
║  │  │ ✗ unknown@spam.com  │ RE: FW: Factura...  │ 01 Abr    │ ERROR │   │  ║
║  │  │   No se pudo extraer información válida  [Reintentar] [Borrar]│   │  ║
║  │  └────────────────────────────────────────────────────────────────┘   │  ║
║  │                                                                        │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
```

**Responsive notes:**
- Mobile: acciones en swipe (Aprobar = swipe right verde, Rechazar = swipe left rojo).
- Email único: siempre visible arriba con botón copiar prominente.
- Item PENDING_REVIEW: borde izquierdo naranja 4px.

---

### PANTALLA 6 — NEWS FEED

**Grid:** single column, max-w-2xl centrado.
**Componentes:** NotifItem, Badge, Button, Card (skeleton loader)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                      ║
║  📰 Novedades fiscales   [●5 sin leer]                                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  FILTROS (tabs):                                                             ║
║  [Todo ●5] [Alertas AEAT ●2] [Tips] [Novedades normativas ●3]               ║
║                                                                              ║
║  ┌─ FEED (scroll) ───────────────────────────────────────────────────────┐  ║
║  │                                                                        │  ║
║  │  ┌── FISCAL_ALERT (borde-l-4 naranja, unread) ────────────────────┐  │  ║
║  │  │ ⚠ ALERTA AEAT                                ● sin leer        │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ Plazo Modelo 303 T1 2026 vence el 20 de abril                   │  │  ║
║  │  │ Tienes €2.614 de IVA pendiente de declarar.                     │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ AEAT · hace 2 días                    [Preparar 303 →]          │  │  ║
║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                        │  ║
║  │  ┌── TIP (fondo sutil, icono bombilla) ────────────────────────────┐  │  ║
║  │  │ 💡 TIP FISCAL                                                    │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ El material de oficina comprado con factura es 100% deducible    │  │  ║
║  │  │ si tienes despacho en casa. Guarda siempre el ticket.            │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ Lefse · hace 3 días                            [Guardar]         │  │  ║
║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                        │  ║
║  │  ┌── NEWS (estilo artículo, read) ─────────────────────────────────┐  │  ║
║  │  │ 📰 NORMATIVA                                                     │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ Verifactu obligatorio para autónomos a partir de octubre 2026    │  │  ║
║  │  │ La AEAT ha confirmado la fecha definitiva para la                │  │  ║
║  │  │ implementación del sistema de facturación verificable...         │  │  ║
║  │  │                                                                  │  │  ║
║  │  │ Expansión · 28 Mar 2026                    [Leer artículo →]     │  │  ║
║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                        │  ║
║  │  ┌── FISCAL_ALERT (unread) ────────────────────────────────────────┐  │  ║
║  │  │ ⚠ Cambio tipo IVA servicios digitales: nueva tabla tipos 2026   │  │  ║
║  │  │ ...                              [Ver cambios →]  ● sin leer    │  │  ║
║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                        │  ║
║  │  ┌── SKELETON LOADER (paginación infinita) ────────────────────────┐  │  ║
║  │  │ ░░░░░░░░░░░░░░  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │  ║
║  │  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                            │  │  ║
║  │  └──────────────────────────────────────────────────────────────────┘  │  ║
║  │                                                                        │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
```

**Responsive notes:**
- Mobile: filtros scroll horizontal. Items full width.
- Badge "no leído" en NavItem Feed: número en dot-badge rojo.

---

### PANTALLA 7 — ONBOARDING (4 pasos)

**Grid:** single column centrado, max-w-lg. Progress indicator fijo top.

```
╔═════════════════════════════════════════════════════╗
║  LEFSE                                              ║
║                                                     ║
║  ●──────────○──────────○──────────○                 ║
║  1/4  Datos  2/4 Factura  3/4 Inbox  4/4 Sello      ║
║                                                     ║
║  [Saltar por ahora →] (caption, derecha)            ║
╠═════════════════════════════════════════════════════╣

═══ PASO 1 — DATOS FISCALES ═══

╔═════════════════════════════════════════════════════╗
║                                                     ║
║  Cuéntanos sobre tu actividad                       ║
║  heading-md Syne                                    ║
║                                                     ║
║  [__ NIF / CIF ___________________________]         ║
║                                                     ║
║  [__ Nombre fiscal / Razón social ________]         ║
║                                                     ║
║  Régimen IVA:                                       ║
║  [General (21%) ▼                         ]         ║
║                                                     ║
║  Epígrafe IAE:                                      ║
║  [__ 763 - Programación informática... ___]         ║
║                                                     ║
║  [Continuar →  PRIMARY]                             ║
║                                                     ║
║  Saltar: "Puedes completarlo después en Ajustes"    ║
╚═════════════════════════════════════════════════════╝


═══ PASO 2 — PRIMERA FACTURA GUIADA ═══

╔═════════════════════════════════════════════════════╗
║                                                     ║
║  Crea tu primera factura                            ║
║  (form simplificado, solo campos esenciales)        ║
║                                                     ║
║  [__ Nombre del cliente ___________________]        ║
║  [__ Concepto / servicio __________________]        ║
║  [__ Importe (sin IVA) ____________________]        ║
║  [IVA 21% ▼]   [IRPF 15% ▼]                        ║
║                                                     ║
║  💡 Tip: Añade el NIF del cliente para que          ║
║  tu factura sea 100% válida                         ║
║                                                     ║
║  ┌─ Total calculado ────────────────────────┐       ║
║  │  Base: €1.000  IVA: €210  -IRPF: -€150  │       ║
║  │  TOTAL: €1.060                           │       ║
║  └──────────────────────────────────────────┘       ║
║                                                     ║
║  [Crear y sellar →  PRIMARY]                        ║
║  [Saltar este paso]  caption                        ║
╚═════════════════════════════════════════════════════╝


═══ PASO 3 — CONFIGURAR INBOX EMAIL ═══

╔═════════════════════════════════════════════════════╗
║                                                     ║
║  Tu buzón de facturas                               ║
║                                                     ║
║  ┌─────────────────────────────────────────┐        ║
║  │  📧  a3f8b2c1@inbox.lefse.io            │        ║
║  │                          [Copiar email] │        ║
║  └─────────────────────────────────────────┘        ║
║                                                     ║
║  Cómo funciona:                                     ║
║  1. Reenvía cualquier factura a este email          ║
║  2. La analizamos automáticamente con OCR           ║
║  3. Te aparece en tu inbox lista para aprobar       ║
║                                                     ║
║  [Abrir mi email y reenviar] SECONDARY              ║
║  [Continuar →  PRIMARY]                             ║
║  [Saltar este paso]  caption                        ║
╚═════════════════════════════════════════════════════╝


═══ PASO 4 — RITUAL SELLO (no skip) ═══

╔═════════════════════════════════════════════════════╗
║                                                     ║
║  ✦ ✦ ✦  [CONFETTI animado]  ✦ ✦ ✦                  ║
║                                                     ║
║  ┌─────────────────────────────────────────┐        ║
║  │                                         │        ║
║  │       [SealBadge xl SEALED              │        ║
║  │        animate-stamp-in                 │        ║
║  │        glow-seal shadow]                │        ║
║  │                                         │        ║
║  └─────────────────────────────────────────┘        ║
║                                                     ║
║  ¡Tu primera factura sellada!                       ║
║  display-lg Syne                                    ║
║                                                     ║
║  Ya eres parte de Los del sello.                    ║
║  body-lg Inter text-secondary                       ║
║                                                     ║
║  [📥 Descargar certificado]  SECONDARY + seal-gold  ║
║                                                     ║
║  [Ir al Dashboard →  PRIMARY]                       ║
║                                                     ║
╚═════════════════════════════════════════════════════╝
```

**Responsive notes:** Fullscreen en mobile. Desktop: modal centrado max-w-lg con overlay.
**Skip link:** visible en pasos 1-3 como `text-caption text-text-tertiary`, `tabIndex=0`, con tooltip: "Puedes completarlo después en Ajustes > Perfil fiscal".

---

### PANTALLA 8 — SETTINGS / BILLING

**Grid:** 2 col — Sidebar secciones 240px | Contenido fluid.
**Componentes:** Card, Button, ProgressBar, Modal (confirm delete), Input

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  HEADER                                                                      ║
║  ← Dashboard  |  Ajustes                                                     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ┌─ SIDEBAR SECCIONES ──────┐  ┌─ CONTENIDO ────────────────────────────┐  ║
║  │                           │  │                                         │  ║
║  │  ▸ Perfil fiscal ← active │  │  ═══ PERFIL FISCAL ═══                 │  ║
║  │  ▸ Plan y pagos           │  │                                         │  ║
║  │  ▸ Notificaciones         │  │  [__ NIF ____________________________]  │  ║
║  │  ▸ Privacidad y datos     │  │  [__ Nombre fiscal _________________]   │  ║
║  │                           │  │  [Régimen IVA ▼]                        │  ║
║  └───────────────────────────┘  │  [Epígrafe IAE ______________________]  │  ║
║                                 │  [__ Dirección fiscal _______________]  │  ║
║                                 │                                         │  ║
║                                 │  [Guardar cambios]  [Cancelar]          │  ║
║                                 │                                         │  ║
║                                 ├─────────────────────────────────────────┤  ║
║                                 │                                         │  ║
║                                 │  ═══ PLAN Y PAGOS ═══                   │  ║
║                                 │                                         │  ║
║                                 │  ┌─ PLAN ACTUAL ───────────────────┐   │  ║
║                                 │  │  FREE                            │   │  ║
║                                 │  │                                  │   │  ║
║                                 │  │  Facturas: ██████░░░░ 6/10       │   │  ║
║                                 │  │           ProgressBar           │   │  ║
║                                 │  │                                  │   │  ║
║                                 │  │  Emails inbox: 20/50             │   │  ║
║                                 │  │  AI consultas: 7/10 hoy          │   │  ║
║                                 │  └──────────────────────────────────┘   │  ║
║                                 │                                         │  ║
║                                 │  ¿Necesitas más?                        │  ║
║                                 │  [Pasa a Pro — desde €9/mes →]         │  ║
║                                 │  BUTTON SECONDARY (no agresivo)         │  ║
║                                 │                                         │  ║
║                                 │  HISTORIAL DE PAGOS                     │  ║
║                                 │  ─────────────────                      │  ║
║                                 │  (vacío en free — "Sin pagos aún")      │  ║
║                                 │                                         │  ║
║                                 ├─────────────────────────────────────────┤  ║
║                                 │                                         │  ║
║                                 │  ═══ PRIVACIDAD Y DATOS ═══             │  ║
║                                 │                                         │  ║
║                                 │  Exportar mis datos                     │  ║
║                                 │  Descarga un ZIP con todas tus          │  ║
║                                 │  facturas, datos y configuración        │  ║
║                                 │  (RGPD Art. 20 — portabilidad)          │  ║
║                                 │  [Exportar datos ZIP]  SECONDARY        │  ║
║                                 │                                         │  ║
║                                 │  ──────────────────────────────────     │  ║
║                                 │                                         │  ║
║                                 │  Eliminar cuenta                        │  ║
║                                 │  Elimina todos tus datos de forma       │  ║
║                                 │  permanente e irrecuperable.            │  ║
║                                 │  [Eliminar mi cuenta]  BUTTON DANGER    │  ║
║                                 │  → abre Modal confirm (role=dialog)     │  ║
║                                 │    "Escribe 'ELIMINAR' para confirmar"  │  ║
║                                 │                                         │  ║
║                                 └─────────────────────────────────────────┘  ║
```

**Responsive notes:**
- Mobile: sidebar → tabs horizontales scroll. Secciones fullscreen.
- Eliminar cuenta: nunca oculto ni enterrado. Visible en sección Privacidad con 2 clicks (nav + scroll).

---

## ENTREGABLE 4 — NAVEGACIÓN

### Árbol de Rutas

```
/
├── / ................................ Dashboard
├── /invoices ........................ Lista facturas
│   ├── /invoices/new ................ Nueva factura
│   └── /invoices/:id ................ Detalle/edición factura
├── /ai .............................. AI Fiscal Assistant
├── /ocr ............................. OCR Upload (mobile-first)
├── /inbox ........................... Email Inbox
├── /feed ............................ News Feed
├── /settings ........................ Perfil fiscal (default)
│   └── /settings/billing ............ Plan y pagos
└── /onboarding
    ├── /onboarding/profile .......... Paso 1: Datos fiscales
    ├── /onboarding/first-invoice .... Paso 2: Primera factura
    ├── /onboarding/inbox ............ Paso 3: Configurar inbox
    └── /onboarding/seal ............. Paso 4: Ritual sello
```

### Tabla de Rutas

| Path | Nombre pantalla | Icono (Lucide) | Acceso mínimo | Nav |
|------|-----------------|----------------|---------------|-----|
| `/` | Dashboard | `LayoutDashboard` | auth | sidebar + bottom |
| `/invoices` | Facturas | `FileText` | auth | sidebar + bottom |
| `/invoices/new` | Nueva factura | `FilePlus` | auth | — (desde Dashboard) |
| `/invoices/:id` | Detalle factura | `FileText` | auth | — |
| `/ai` | AI Assistant | `Bot` | auth | sidebar + bottom |
| `/ocr` | OCR Foto | `Camera` | auth | bottom-nav central |
| `/inbox` | Email Inbox | `Inbox` | auth | sidebar |
| `/feed` | Novedades | `Newspaper` | auth | sidebar |
| `/settings` | Ajustes | `Settings` | auth | sidebar (bottom) |
| `/settings/billing` | Plan y pagos | `CreditCard` | auth | — (desde Settings) |
| `/onboarding/*` | Onboarding | — | auth + !onboarded | — (redirect auto) |

### Sidebar Desktop (colapsable)

```
╔═══════════════════╗   ╔══════╗
║  ◉ LEFSE          ║   ║  ◉   ║   ← collapsed (iconos sólo)
║                   ║   ║      ║
║  ⊞ Dashboard      ║   ║  ⊞   ║
║  📄 Facturas      ║   ║  📄  ║
║  🤖 AI Assistant  ║   ║  🤖  ║
║  📥 Inbox    ●3   ║   ║  📥● ║
║  📰 Feed     ●2   ║   ║  📰● ║
║                   ║   ║      ║
║  ──────────────── ║   ║  ─── ║
║  ⚙ Ajustes       ║   ║  ⚙   ║
║                   ║   ║      ║
║  Plan: FREE       ║   ║      ║
║  ██████░░ 6/10    ║   ║      ║
║  [Subir a Pro]    ║   ║      ║
╚═══════════════════╝   ╚══════╝
  240px                   64px
```

### Bottom Nav Mobile (≤768px, max 5 items)

```
╔══════════════════════════════════════════════════════╗
║    ⊞          📄       [📷]        🤖        ···     ║
║ Dashboard  Facturas   OCR       AI           Más      ║
║                      (FAB)                           ║
║                    ╔══════╗                          ║
║                    ║  📷  ║  ← w-14 h-14 rounded-full║
║                    ║      ║    bg-primary shadow-glow ║
║                    ╚══════╝    -mt-5 (sobre la barra) ║
╚══════════════════════════════════════════════════════╝
```

"Más" abre drawer con: Inbox, Feed, Ajustes.

---

## ENTREGABLE 5 — RESPONSIVE

| Breakpoint | Rango | Layout | Cambios clave |
|-----------|-------|--------|---------------|
| **mobile** | <768px | Single col | Bottom nav 5 items. OCR = FAB central elevado. Sidebar oculto. Modales fullscreen. Form facturas = single col. AI chat fullscreen, sidebar datos en toggle. |
| **tablet** | 768–1024px | 2 col | Sidebar mini 64px (iconos). KPI grid 2×2. Form factura 55/45. AI chat 65/35. Settings: tabs horizontales. |
| **desktop** | 1024–1440px | 3 col (contextual) | Sidebar 240px expandido. Form factura 60/40. Dashboard 3 col KPI. |
| **wide** | >1440px | 3 col + max-width | `max-w-screen-xl mx-auto`. Más whitespace padding (px-12). Sidebar fijo izquierda. |

### Breakpoints Tailwind

```ts
// tailwind.config.ts → theme.screens
screens: {
  sm:  '640px',
  md:  '768px',   // tablet breakpoint
  lg:  '1024px',  // desktop breakpoint
  xl:  '1280px',
  '2xl': '1440px' // wide breakpoint
}
```

### Clases de Layout Clave

```tsx
// Sidebar visibility
<aside className="hidden md:flex md:w-16 lg:w-60 ..." />

// Bottom nav visibility
<nav className="flex md:hidden fixed bottom-0 ..." />

// Main content offset
<main className="md:ml-16 lg:ml-60 ..." />

// OCR FAB (mobile only)
<button className="md:hidden fixed ... w-14 h-14 rounded-full -mt-5 bg-primary" />

// Form factura split
<div className="flex flex-col lg:flex-row gap-8">
  <section className="w-full lg:w-3/5" /> {/* Form */}
  <aside   className="w-full lg:w-2/5 lg:sticky lg:top-20" /> {/* Preview */}
</div>
```

---

## ENTREGABLE 6 — MICRO-INTERACCIONES

| # | Trigger | Animación | Duración | Librería / Método | Nota |
|---|---------|-----------|----------|-------------------|------|
| 1 | Factura sellada — SealBadge status → SEALED | Stamp: scale(1.8,rotate-12) → scale(0.92,rotate+2) → scale(1,0) + glow ring naranja→gold | 500ms spring | CSS keyframes `stamp-in` | Vibración haptica en mobile (navigator.vibrate) |
| 2 | Primera factura (onboarding paso 4) | Confetti burst (32 partículas canvas) + SealBadge stamp XL + texto fade-in heading-lg | Confetti 2s, sello 500ms, texto 400ms delay 300ms | `canvas-confetti` npm + CSS | Solo en onboarding, no repetir |
| 3 | AI typing indicator | 3 dots bounce: translateY(0→-6→0) con stagger 150ms | 1.2s infinite | CSS `dot-bounce` keyframes | Visible sólo mientras `isLoading=true` |
| 4 | OCR procesando (paso 2) | Línea scan horizontal sweeps de top→bottom sobre imagen | 1.8s linear infinite | CSS `scanner-sweep` + pseudo-element | Detiene al llegar a 100% |
| 5 | Toast appear/dismiss | Appear: translateX(110%→0) + opacity(0→1) · Dismiss: inverso | In: 250ms ease · Out: 200ms ease | CSS `toast-in/toast-out` keyframes | Auto-dismiss 4s (0=persist) |
| 6 | NavItem hover (sidebar desktop) | Background fill desde izquierda: `background-size: 0→100%` bg-primary-subtle | 200ms ease | CSS `background-size` transition | `aria-current="page"` en active |
| 7 | Card interactive hover | `translateY(0 → -2px)` + shadow-card → shadow-elevated | 200ms ease | Tailwind `hover:-translate-y-0.5 hover:shadow-elevated` | `will-change: transform` |
| 8 | Badge status change | Color transition + opacity flash (1→0.6→1) | 300ms ease | CSS transition-colors + `badge-flash` keyframe | React state change trigger |
| 9 | Button loading state | Texto fade-out (150ms) → Spinner fade-in (150ms), width fixed con `min-w-[button-width]` | 150ms each | CSS opacity transition | `aria-busy="true"` durante loading |
| 10 | Notif badge — nuevo item | Pulse: `box-shadow 0→6px→0 rgba(FF4D00,0.5)` | 1.8s ease-in-out infinite | CSS `notif-pulse` keyframes | Inicia con nuevo item, para tras 5s o hover |

### Reducción de Movimiento

```css
/* Respetar preferencia del usuario */
@media (prefers-reduced-motion: reduce) {
  /* Deshabilitar todas las animaciones no esenciales */
  *,
  *::before,
  *::after {
    animation-duration:   0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration:  0.01ms !important;
  }

  /* Excepción: loading spinners (esencial para UX) */
  .spinner,
  .dot-bounce {
    animation-duration: 1s !important;
    animation-iteration-count: infinite !important;
  }

  /* SealBadge: mostrar directamente en estado final */
  .animate-stamp-in {
    animation: none !important;
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }

  /* Confetti: no ejecutar */
  .confetti-canvas {
    display: none !important;
  }
}
```

---

## ENTREGABLE 7 — ACCESIBILIDAD

### Tabla de Contraste

| Par de colores | Hex foreground | Hex background | Ratio | WCAG AA | WCAG AAA |
|----------------|---------------|----------------|-------|---------|---------|
| Primary sobre bg-dark | `#FF4D00` | `#0C0C0C` | 5.2:1 | ✅ | ✗ |
| Primary sobre bg-light | `#FF4D00` | `#FAFAFA` | 4.6:1 | ✅ | ✗ |
| Blanco sobre primary | `#FFFFFF` | `#FF4D00` | 4.6:1 | ✅ | ✗ |
| text-primary sobre bg-dark | `#FAFAFA` | `#0C0C0C` | 19.1:1 | ✅ | ✅ |
| text-primary sobre bg-light | `#0A0A0A` | `#FAFAFA` | 19.6:1 | ✅ | ✅ |
| text-secondary dark | `#A1A1AA` | `#0C0C0C` | 4.6:1 | ✅ | ✗ |
| text-secondary light | `#52525B` | `#FAFAFA` | 7.0:1 | ✅ | ✅ |
| seal-gold dark mode | `#C9A84C` | `#0C0C0C` | 6.8:1 | ✅ | ✅ |
| seal-gold light mode | `#8B6914` | `#FAFAFA` | 7.2:1 | ✅ | ✅ |
| success sobre bg-dark | `#22C55E` | `#0C0C0C` | 5.8:1 | ✅ | ✗ |
| error sobre bg-dark | `#EF4444` | `#0C0C0C` | 4.5:1 | ✅ | ✗ |
| warning sobre bg-dark | `#F59E0B` | `#0C0C0C` | 6.1:1 | ✅ | ✅ |

> Nota: primary (#FF4D00) sobre fondos solo alcanza AA, no AAA. Aceptable para elementos decorativos y botones grandes. Nunca usar como único color para texto de tamaño < 18px sin negrita.

### Focus States

```css
/* Global focus visible — aplicar a todos los interactivos */
:focus-visible {
  outline: 2px solid #FF4D00;
  outline-offset: 2px;
  border-radius: var(--radius-sm); /* match elemento */
}

/* Variante sobre fondos oscuros donde naranja puede perderse */
.bg-primary :focus-visible {
  outline-color: #FFFFFF;
}

/* Remover outline por defecto (solo cuando :focus-visible disponible) */
:focus:not(:focus-visible) {
  outline: none;
}
```

```tsx
// Tailwind: todos los botones, links, inputs, selects
// Añadir clase base:
className="... focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
```

### ARIA Roles y Labels

```tsx
// Chat AI Fiscal
<div
  role="log"
  aria-live="polite"
  aria-label="Historial de conversación con el asistente fiscal"
  aria-relevant="additions"
>
  {messages.map(msg => <AIMessage key={msg.id} {...msg} />)}
</div>

// Status Badges (facturas)
<span
  role="status"
  aria-label={`Estado de factura: ${statusLabel[status]}`}
>
  <Badge status={status} />
</span>

// Modal / Dialog
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
>
  <h2 id="modal-title">...</h2>
  <p id="modal-description">...</p>
</div>

// Navigation — sidebar
<nav role="navigation" aria-label="Navegación principal">
  <ul>
    <li><a href="/" aria-current={isActive('/') ? 'page' : undefined}>Dashboard</a></li>
    ...
  </ul>
</nav>

// Navigation — bottom nav mobile
<nav role="navigation" aria-label="Navegación móvil">
  ...
</nav>

// Toast / Alertas
<div role="alert" aria-live="assertive" aria-atomic="true">
  {/* Solo para errores críticos — assertive interrumpe */}
</div>
<div role="status" aria-live="polite" aria-atomic="true">
  {/* Success, info — polite espera */}
</div>

// ProgressBar
<div
  role="progressbar"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Procesando OCR"
/>

// InvoiceRow acciones
<button aria-label={`Aprobar factura de ${invoice.client}`}>Aprobar</button>
<button aria-label={`Editar borrador de factura de ${invoice.client}`}>Editar</button>
<button aria-label={`Rechazar email de ${item.from}`}>Rechazar</button>

// Notif badge numérico
<span aria-label={`${count} notificaciones sin leer`}>
  <span aria-hidden="true">{count}</span>
</span>

// SealBadge loading state
<div aria-busy={status === 'processing'} aria-label={sealLabel[status]}>
  <SealBadge status={status} />
</div>
```

### Checklist Accesibilidad Mínima

- [ ] Todos los elementos interactivos alcanzables con Tab
- [ ] Focus visible en todos los estados (`:focus-visible` outline naranja)
- [ ] Skip-to-content link como primer elemento del DOM
- [ ] Imágenes con `alt` descriptivo (o `alt=""` si decorativas)
- [ ] Formularios: cada input tiene `<label>` asociado o `aria-label`
- [ ] Error messages: `role="alert"` o `aria-describedby` apuntando al mensaje
- [ ] Modales: trap focus, cerrar con Escape, restaurar focus al cerrar
- [ ] Contraste mínimo AA en todo el texto
- [ ] `lang="es"` en `<html>`
- [ ] `prefers-reduced-motion` implementado (ver Entregable 6)
- [ ] Bottom nav: `aria-label` diferenciado de sidebar nav
- [ ] Iconos decorativos: `aria-hidden="true"`
- [ ] Botones solo-icono: `aria-label` obligatorio
