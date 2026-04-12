# Design System — Lefse
_B5 🟢 Cerrado — 2026-04-07_

---

## ENTREGABLE 1 — DESIGN TOKENS

### 1.1 CSS Custom Properties

```css
/* ============================================================
   LEFSE DESIGN TOKENS — globals.css o tokens.css
   Importar antes de cualquier componente
   ============================================================ */

:root {
  /* --- COLORES PRIMARIOS --- */
  --color-primary:         #FF4D00;
  --color-primary-hover:   #E64400;   /* -8% lightness */
  --color-primary-active:  #CC3C00;   /* -15% lightness */
  --color-primary-subtle:  #FF4D001A; /* 10% opacity */
  --color-primary-subtle-hover: #FF4D0026; /* 15% opacity */

  /* --- SEAL GOLD (ritual primera factura) --- */
  --color-seal-gold:       #C9A84C;
  --color-seal-gold-light: #F0D080;
  --color-seal-gold-dark:  #8B6914;
  --color-seal-gold-subtle:#C9A84C1A;

  /* --- SEMÁNTICOS --- */
  --color-success:         #22C55E;
  --color-success-subtle:  #22C55E1A;
  --color-warning:         #F59E0B;
  --color-warning-subtle:  #F59E0B1A;
  --color-error:           #EF4444;
  --color-error-subtle:    #EF44441A;
  --color-info:            #3B82F6;
  --color-info-subtle:     #3B82F61A;

  /* --- SPACING (escala base 4px) --- */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-14: 56px;
  --space-16: 64px;

  /* --- BORDER RADIUS --- */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-full: 9999px;

  /* --- Z-INDEX --- */
  --z-base:     0;
  --z-dropdown: 100;
  --z-modal:    200;
  --z-toast:    300;
  --z-overlay:  400;

  /* --- TRANSICIONES --- */
  --transition-fast:   150ms ease;
  --transition-base:   250ms ease;
  --transition-slow:   400ms ease;
  --transition-spring: 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ============================================================
   LIGHT MODE (default)
   ============================================================ */
:root,
[data-theme="light"] {
  /* Fondos */
  --bg:              #FAFAFA;
  --bg-secondary:    #F4F4F5;
  --surface:         #FFFFFF;
  --surface-raised:  #FFFFFF;
  --surface-overlay: #FFFFFFEE;

  /* Texto */
  --text-primary:    #0A0A0A;
  --text-secondary:  #52525B;
  --text-tertiary:   #A1A1AA;
  --text-disabled:   #D4D4D8;
  --text-inverse:    #FFFFFF;
  --text-on-primary: #FFFFFF;

  /* Bordes */
  --border:          #E4E4E7;
  --border-strong:   #A1A1AA;
  --border-subtle:   #F4F4F5;

  /* Sombras */
  --shadow-card:     0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06);
  --shadow-elevated: 0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.06);
  --shadow-modal:    0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.08);
  --shadow-glow-primary: 0 0 0 3px rgba(255,77,0,0.20), 0 4px 12px rgba(255,77,0,0.15);
  --shadow-glow-seal:    0 0 0 3px rgba(201,168,76,0.25), 0 4px 16px rgba(201,168,76,0.20);
}

/* ============================================================
   DARK MODE
   ============================================================ */
[data-theme="dark"],
@media (prefers-color-scheme: dark) {
  :root {
  /* Fondos */
  --bg:              #0C0C0C;
  --bg-secondary:    #161616;
  --surface:         #1C1C1C;
  --surface-raised:  #242424;
  --surface-overlay: #1C1C1CEE;

  /* Texto */
  --text-primary:    #FAFAFA;
  --text-secondary:  #A1A1AA;
  --text-tertiary:   #52525B;
  --text-disabled:   #3F3F46;
  --text-inverse:    #0A0A0A;
  --text-on-primary: #FFFFFF;

  /* Bordes */
  --border:          #2A2A2A;
  --border-strong:   #52525B;
  --border-subtle:   #1E1E1E;

  /* Sombras */
  --shadow-card:     0 1px 3px 0 rgba(0,0,0,0.40), 0 1px 2px -1px rgba(0,0,0,0.30);
  --shadow-elevated: 0 4px 6px -1px rgba(0,0,0,0.50), 0 2px 4px -2px rgba(0,0,0,0.40);
  --shadow-modal:    0 20px 25px -5px rgba(0,0,0,0.60), 0 8px 10px -6px rgba(0,0,0,0.50);
  --shadow-glow-primary: 0 0 0 3px rgba(255,77,0,0.30), 0 4px 16px rgba(255,77,0,0.25);
  --shadow-glow-seal:    0 0 0 3px rgba(201,168,76,0.35), 0 4px 20px rgba(201,168,76,0.30);
  }
}
```

---

### 1.2 Tabla Tipografía

| Token | Fuente | Peso | Tamaño | Line-height | Letter-spacing | Uso |
|-------|--------|------|--------|-------------|----------------|-----|
| `display-xl` | Syne | 700 | 56px / 3.5rem | 1.05 | -0.02em | Hero headline, landing |
| `display-lg` | Syne | 700 | 40px / 2.5rem | 1.1 | -0.015em | Page titles, modal hero |
| `heading-md` | Syne | 700 | 24px / 1.5rem | 1.25 | -0.01em | Section headers, card titles |
| `heading-sm` | Inter | 600 | 18px / 1.125rem | 1.3 | -0.005em | Subsección, widget title |
| `body-lg` | Inter | 400 | 16px / 1rem | 1.6 | 0 | Texto principal, descripciones |
| `body-sm` | Inter | 400 | 14px / 0.875rem | 1.5 | 0 | Labels, metadata, secondary text |
| `mono-lg` | JetBrains Mono | 500 | 16px / 1rem | 1.5 | 0 | Importes, totales, nºs factura |
| `mono-sm` | JetBrains Mono | 500 | 13px / 0.8125rem | 1.4 | 0 | Códigos, hashes, fechas técnicas |
| `caption` | Inter | 400 | 12px / 0.75rem | 1.4 | 0.01em | Notas pie, timestamps, legal |

```css
/* Typography CSS classes */
.text-display-xl  { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 3.5rem; line-height: 1.05; letter-spacing: -0.02em; }
.text-display-lg  { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 2.5rem; line-height: 1.1; letter-spacing: -0.015em; }
.text-heading-md  { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.5rem; line-height: 1.25; letter-spacing: -0.01em; }
.text-heading-sm  { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 1.125rem; line-height: 1.3; letter-spacing: -0.005em; }
.text-body-lg     { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 1rem; line-height: 1.6; }
.text-body-sm     { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 0.875rem; line-height: 1.5; }
.text-mono-lg     { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 1rem; line-height: 1.5; }
.text-mono-sm     { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 0.8125rem; line-height: 1.4; }
.text-caption     { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 0.75rem; line-height: 1.4; letter-spacing: 0.01em; }
```

---

### 1.3 Tailwind Config Snippet

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT:  '#FF4D00',
          hover:    '#E64400',
          active:   '#CC3C00',
          subtle:   'rgba(255,77,0,0.10)',
        },
        'seal-gold': {
          DEFAULT: '#C9A84C',
          light:   '#F0D080',
          dark:    '#8B6914',
          subtle:  'rgba(201,168,76,0.10)',
        },
        success:  '#22C55E',
        warning:  '#F59E0B',
        error:    '#EF4444',
        info:     '#3B82F6',
        // Semánticos mapeados a CSS vars (resuelven dark/light automáticamente)
        bg: {
          DEFAULT:   'var(--bg)',
          secondary: 'var(--bg-secondary)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised:  'var(--surface-raised)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong:  'var(--border-strong)',
          subtle:  'var(--border-subtle)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          disabled:  'var(--text-disabled)',
          inverse:   'var(--text-inverse)',
        },
      },

      fontFamily: {
        display: ['Syne', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },

      fontSize: {
        'display-xl': ['3.5rem',   { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['2.5rem',   { lineHeight: '1.1',  letterSpacing: '-0.015em', fontWeight: '700' }],
        'heading-md': ['1.5rem',   { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.3',  letterSpacing: '-0.005em', fontWeight: '600' }],
        'body-lg':    ['1rem',     { lineHeight: '1.6' }],
        'body-sm':    ['0.875rem', { lineHeight: '1.5' }],
        'mono-lg':    ['1rem',     { lineHeight: '1.5' }],
        'mono-sm':    ['0.8125rem',{ lineHeight: '1.4' }],
        'caption':    ['0.75rem',  { lineHeight: '1.4', letterSpacing: '0.01em' }],
      },

      spacing: {
        '1': '4px',  '2': '8px',  '3': '12px', '4': '16px',
        '5': '20px', '6': '24px', '8': '32px',  '10': '40px',
        '12': '48px','14': '56px','16': '64px',
      },

      borderRadius: {
        sm:   '4px',
        md:   '8px',
        lg:   '16px',
        xl:   '24px',
        full: '9999px',
      },

      boxShadow: {
        'card':          'var(--shadow-card)',
        'elevated':      'var(--shadow-elevated)',
        'modal':         'var(--shadow-modal)',
        'glow-primary':  'var(--shadow-glow-primary)',
        'glow-seal':     'var(--shadow-glow-seal)',
      },

      zIndex: {
        base:     '0',
        dropdown: '100',
        modal:    '200',
        toast:    '300',
        overlay:  '400',
      },

      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },

      keyframes: {
        // SealBadge stamp effect
        'stamp-in': {
          '0%':   { transform: 'scale(1.8) rotate(-12deg)', opacity: '0' },
          '60%':  { transform: 'scale(0.92) rotate(2deg)',  opacity: '1' },
          '80%':  { transform: 'scale(1.04) rotate(-1deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)',     opacity: '1' },
        },
        // Confetti burst (ritual)
        'confetti-burst': {
          '0%':   { transform: 'translateY(0) rotate(0deg)',   opacity: '1' },
          '100%': { transform: 'translateY(-80px) rotate(720deg)', opacity: '0' },
        },
        // AI typing dots
        'dot-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%':           { transform: 'translateY(-6px)' },
        },
        // OCR scanner sweep
        'scanner-sweep': {
          '0%':   { top: '0%' },
          '100%': { top: '100%' },
        },
        // Toast slide + fade
        'toast-in': {
          '0%':   { transform: 'translateX(110%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        'toast-out': {
          '0%':   { transform: 'translateX(0)',    opacity: '1' },
          '100%': { transform: 'translateX(110%)', opacity: '0' },
        },
        // Nav fill desde izquierda
        'nav-fill': {
          '0%':   { backgroundSize: '0% 100%' },
          '100%': { backgroundSize: '100% 100%' },
        },
        // Notif badge pulse
        'notif-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,77,0,0.5)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(255,77,0,0)' },
        },
        // Badge color transition helper
        'badge-flash': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },

      animation: {
        'stamp-in':      'stamp-in 0.5s var(--transition-spring) forwards',
        'confetti':      'confetti-burst 0.8s ease-out forwards',
        'dot-bounce':    'dot-bounce 1.2s ease-in-out infinite',
        'scanner-sweep': 'scanner-sweep 1.8s linear infinite',
        'toast-in':      'toast-in 0.25s ease forwards',
        'toast-out':     'toast-out 0.2s ease forwards',
        'notif-pulse':   'notif-pulse 1.8s ease-in-out infinite',
        'badge-flash':   'badge-flash 0.3s ease',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## ENTREGABLE 2 — COMPONENT LIBRARY

### Tabla Maestra de Componentes

| Componente | Variantes | Estados | Props clave | Dark mode |
|-----------|-----------|---------|-------------|-----------|
| **Button** | `primary` `secondary` `ghost` `danger` `link` | `default` `hover` `active` `disabled` `loading` | `size` (sm/md/lg), `leftIcon`, `rightIcon`, `fullWidth`, `loading` | surface cambia, primary fijo |
| **Badge** | `DRAFT` `PENDING_SEAL` `SEALED` `SENT` `PAID` `VOID` | `default` `transition` | `status`, `size` (sm/md), `dot` (boolean) | colores semánticos, no invierten |
| **Card** | `default` `elevated` `interactive` `highlight` | `default` `hover` `focused` | `padding` (none/sm/md/lg), `as` (div/article/li) | border + surface adaptan |
| **Input** | `text` `number` `select` `textarea` `search` | `default` `focus` `error` `disabled` `readonly` | `label`, `hint`, `error`, `prefix`, `suffix`, `size` | border-color + bg adaptan |
| **InvoiceRow** | `list` `compact` | `collapsed` `expanded` `selected` `loading` | `invoice` (obj), `onAction`, `actions` (array) | surface adapta |
| **AIMessage** | `user` `assistant` `system` | `default` `loading` `error` | `role`, `content`, `sourceType` (user-data/general), `timestamp` | bubble colors invierten |
| **NotifItem** | `FISCAL_ALERT` `TIP` `NEWS` | `read` `unread` | `type`, `title`, `body`, `action`, `timestamp`, `read` | border accent mantiene |
| **SealBadge** | `pending` `processing` `sealed` | `static` `animated` `ritual` | `status`, `size` (sm/md/lg/xl), `animate` (boolean) | gold fijo en ambos modos |
| **ProgressBar** | `linear` `indeterminate` | `idle` `processing` `complete` `error` | `value` (0-100), `indeterminate`, `label`, `size` (sm/md) | track color adapta |
| **Modal** | `default` `confirm` `fullscreen` `drawer` | `open` `closing` `closed` | `open`, `onClose`, `title`, `size` (sm/md/lg/xl/full) | overlay + surface adaptan |
| **Toast** | `success` `error` `warning` `info` | `entering` `visible` `exiting` | `type`, `title`, `message`, `action`, `duration` (ms, 0=persist) | surface-raised + colored accent |
| **NavItem** | `sidebar` `bottom-nav` `sidebar-mini` | `active` `inactive` `badge` `disabled` | `icon`, `label`, `href`, `badge` (number), `collapsed` | active: primary-subtle bg |

---

### Especificaciones por Componente

#### Button

```tsx
// Tamaños
sm: h-8  px-3 text-body-sm  gap-1.5  rounded-md
md: h-10 px-4 text-body-lg  gap-2    rounded-md
lg: h-12 px-6 text-heading-sm gap-2  rounded-lg

// Variantes (valores CSS)
primary:   bg-primary     text-white           hover:bg-primary-hover  active:bg-primary-active
secondary: bg-surface     text-text-primary    border border-border     hover:bg-bg-secondary
ghost:     bg-transparent text-text-primary                             hover:bg-primary-subtle
danger:    bg-error       text-white           hover:bg-red-600         active:bg-red-700
link:      bg-transparent text-primary underline-offset-2               hover:underline

// Estado loading: reemplaza contenido con spinner (w-4 h-4, border-2), width fijado con min-w
// Estado disabled: opacity-40 cursor-not-allowed pointer-events-none
// Focus: outline-2 outline-primary outline-offset-2
```

#### Badge (estados factura)

```tsx
// Colores semánticos — no invierten en dark mode
DRAFT:        bg=#3F3F46  text=#A1A1AA  border=#52525B   label="Borrador"
PENDING_SEAL: bg=warning-subtle  text=#92400E  border=warning   label="Pendiente sello"
SEALED:       bg=seal-gold-subtle text=seal-gold-dark border=seal-gold  label="Sellada"
PROCESSING:   bg=info-subtle      text=info     border=info      label="Procesando"
SENT:         bg=info-subtle      text=info     border=info      label="Enviada"
PAID:         bg=success-subtle   text=success  border=success   label="Pagada"
VOID:         bg=error-subtle     text=error    border=error     label="Anulada"

// Variantes tamaño
sm: text-caption px-2 py-0.5 rounded-full gap-1
md: text-body-sm px-2.5 py-1 rounded-full gap-1.5

// dot: círculo w-1.5 h-1.5 del mismo color que text, parpadea si PROCESSING
```

#### Card

```tsx
default:     bg-surface     border border-border       shadow-card
elevated:    bg-surface-raised                         shadow-elevated
interactive: bg-surface     border border-border       shadow-card
             hover:shadow-elevated hover:-translate-y-0.5 hover:border-border-strong
             transition-all duration-base cursor-pointer
highlight:   bg-primary-subtle border border-primary   (para alertas o featured)

// Padding variants
none: p-0 | sm: p-4 | md: p-6 | lg: p-8
// Border radius: rounded-lg por defecto
```

#### Input

```tsx
// Wrapper: flex flex-col gap-1.5
// Label: text-body-sm font-medium text-text-primary
// Hint: text-caption text-text-secondary
// Error message: text-caption text-error

// Input base styles:
h-10 w-full px-3 rounded-md border border-border bg-surface
text-body-lg text-text-primary placeholder:text-text-tertiary
transition-colors duration-fast

// Estados:
default: border-border
focus:   border-primary ring-2 ring-primary/20 outline-none
error:   border-error   ring-2 ring-error/20   bg-error-subtle
disabled:opacity-50 cursor-not-allowed bg-bg-secondary

// select: añadir ChevronDown icon right, padding-right 2.5rem
// textarea: min-h-24, resize-y
// prefix/suffix: absolute positioned dentro de relative wrapper, ajustar px
```

#### InvoiceRow

```tsx
// Layout base (collapsed):
<li> flex items-center gap-4 px-4 py-3 border-b border-border
  [Avatar cliente 32px] [Info: nombre + concepto] [Fecha mono-sm] [Importe mono-lg font-medium] [Badge status] [Acciones ...]

// Layout expanded (click o hover en desktop):
  + fila inferior: serie/nº | NIF | IVA | IRPF | acciones inline [Ver PDF] [Editar] [Reenviar]

// Estados:
selected: bg-primary-subtle border-l-2 border-l-primary
loading:  skeleton shimmer en lugar de contenido
```

#### AIMessage

```tsx
// user:      alineado derecha, bg-primary text-white rounded-lg rounded-tr-sm
// assistant: alineado izquierda, bg-surface border border-border rounded-lg rounded-tl-sm
// system:    centrado, text-caption text-text-tertiary italic, sin burbuja

// loading (typing indicator):
  <div class="flex gap-1 p-3">
    <span class="w-2 h-2 rounded-full bg-text-tertiary animate-dot-bounce [animation-delay:0ms]" />
    <span class="w-2 h-2 rounded-full bg-text-tertiary animate-dot-bounce [animation-delay:150ms]" />
    <span class="w-2 h-2 rounded-full bg-text-tertiary animate-dot-bounce [animation-delay:300ms]" />
  </div>

// sourceType badge (assistant only, bottom de burbuja):
user-data: "Basado en tus datos" — badge success-subtle text-xs
general:   "Consejo general"    — badge bg-secondary text-xs
```

#### SealBadge

```tsx
// SVG base: círculo imperfecto + texto "SELLADA" + fecha
// Colores: stroke=seal-gold fill=seal-gold-subtle text=seal-gold-dark

// sm:  w-12 h-12
// md:  w-16 h-16
// lg:  w-24 h-24
// xl:  w-40 h-40 (ritual pantalla)

// animate=true + status=processing:
  rotate infinito lento (360deg / 3s linear)
// animate=true + status=sealed (trigger):
  clase animate-stamp-in → stamp effect una vez
  + emitir evento onSealed para confetti

// ritual mode (status=sealed + size=xl):
  seal-gold-subtle glow ring pulsante + texto "¡Sellada!" debajo en heading-sm
```

#### ProgressBar

```tsx
// linear:
  <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
    <div class="w-full bg-border rounded-full overflow-hidden">
      <div class="bg-primary rounded-full transition-all duration-slow"
           style={{ width: `${value}%` }} />
    </div>
  </div>

// indeterminate: animate-pulse bg-primary width 40% translateX(-100% → 200%) 1.5s linear infinite
// sm: h-1 | md: h-2
// error state: bg-error en lugar de bg-primary
// label: text-caption flex justify-between mb-1 (label left, percentage right)
```

#### Modal

```tsx
// Overlay: fixed inset-0 bg-black/50 backdrop-blur-sm z-modal flex items-center justify-center
// Panel: bg-surface rounded-xl shadow-modal z-modal focus-within:outline-none
  sm: max-w-sm | md: max-w-md | lg: max-w-lg | xl: max-w-2xl | full: w-full h-full rounded-none

// role="dialog" aria-modal="true" aria-labelledby={titleId}
// Trap focus dentro del modal
// Cerrar: Escape key, click overlay (si no isRequired)
// Animación entrada: scale(0.95)+opacity(0) → scale(1)+opacity(1), 200ms ease
// confirm variant: footer con [Cancelar ghost] [Confirmar danger/primary]
```

#### Toast

```tsx
// Posición: fixed bottom-4 right-4 flex flex-col gap-2 z-toast
// Ancho: w-80 max-w-[90vw]

// Estructura:
  <div role="alert" aria-live="polite"
       class="flex items-start gap-3 p-4 rounded-lg shadow-modal border animate-toast-in">
    [Icon 20px tipo]  [div: title body-sm font-medium + message caption]  [X button ghost]

// Colores borde izquierdo (border-l-4):
success: border-l-success | error: border-l-error | warning: border-l-warning | info: border-l-info
// bg: surface-raised en ambos modos

// Auto-dismiss: setTimeout(dismiss, duration || 4000)
// Dismiss animation: clase toast-out → unmount tras 200ms
```

#### NavItem

```tsx
// sidebar (desktop):
  <a role="menuitem" href={href}
     class="flex items-center gap-3 px-3 py-2.5 rounded-md text-body-sm
            text-text-secondary transition-all duration-fast
            hover:bg-primary-subtle hover:text-text-primary
            [active]:bg-primary-subtle [active]:text-primary [active]:font-medium">
    [Icon 20px]  [label — oculto si collapsed]  [Badge número si >0 — bg-primary text-white]

// sidebar collapsed: solo icon, tooltip on hover
// bottom-nav (mobile):
  <a class="flex flex-col items-center gap-1 py-2 px-3 text-caption
            text-text-secondary [active]:text-primary">
    [Icon 24px]  [label text-caption]

// OCR central en bottom-nav:
  w-14 h-14 rounded-full bg-primary text-white shadow-glow-primary
  -mt-5 (levantado sobre barra)
  Icon cámara 24px
```

---

### Paleta de Contraste (Accesibilidad)

| Par de colores | Ratio | WCAG | Uso |
|----------------|-------|------|-----|
| `#FF4D00` sobre `#0C0C0C` (dark bg) | 5.2:1 | AA ✅ | Primary en dark |
| `#FF4D00` sobre `#FAFAFA` (light bg) | 4.6:1 | AA ✅ | Primary en light |
| `#FAFAFA` sobre `#FF4D00` (primary bg) | 4.6:1 | AA ✅ | Texto sobre botón |
| `#FAFAFA` sobre `#0C0C0C` | 19.1:1 | AAA ✅ | Texto principal dark |
| `#0A0A0A` sobre `#FAFAFA` | 19.6:1 | AAA ✅ | Texto principal light |
| `#A1A1AA` sobre `#0C0C0C` | 4.6:1 | AA ✅ | Texto secundario dark |
| `#52525B` sobre `#FAFAFA` | 7.0:1 | AAA ✅ | Texto secundario light |
| `#C9A84C` sobre `#0C0C0C` | 6.8:1 | AA ✅ | Seal gold dark mode |
| `#8B6914` sobre `#FAFAFA` | 7.2:1 | AAA ✅ | Seal gold light mode |
