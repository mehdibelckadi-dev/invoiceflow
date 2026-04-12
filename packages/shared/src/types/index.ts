// ── Plans ─────────────────────────────────────────────────
export type PlanSlug = 'free' | 'starter' | 'pro' | 'agency'
export type BillingPeriod = 'monthly' | 'annual'

// ── Invoice states ────────────────────────────────────────
export type InvoiceStatus =
  | 'DRAFT'
  | 'PENDING_SEAL'
  | 'SEALED'
  | 'SENT'
  | 'PAID'
  | 'VOID'

// ── Verifactu ─────────────────────────────────────────────
export type VerifactuStatus =
  | 'PENDING'
  | 'SIGNING'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ERROR'

// ── OCR ───────────────────────────────────────────────────
export type OcrJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'

// ── Email inbound ─────────────────────────────────────────
export type EmailInboundStatus =
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ERROR'

// ── Notification types ────────────────────────────────────
export type NotificationType =
  | 'FISCAL_ALERT'
  | 'TIP'
  | 'NEWS'
  | 'SYSTEM'
  | 'PROMO'

// ── IVA rates ─────────────────────────────────────────────
export type IvaRate = 0 | 4 | 10 | 21

// ── IRPF rates ────────────────────────────────────────────
export type IrpfRate = 0 | 2 | 7 | 15

// ── Subscription status ───────────────────────────────────
export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'

// ── Regime IVA ────────────────────────────────────────────
export type RegimenIva =
  | 'GENERAL'
  | 'SIMPLIFICADO'
  | 'RECARGO_EQUIVALENCIA'
  | 'EXENTO'
  | 'INTRACOMUNITARIO'
