import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'

export type NotificationType = 'FISCAL_ALERT' | 'TIP' | 'NEWS' | 'SYSTEM' | 'PROMO'

// ── Create ────────────────────────────────────────────────

export async function createNotification(params: {
  userId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
}) {
  const [n] = await db`
    INSERT INTO notifications (user_id, type, title, body, action_url)
    VALUES (${params.userId}, ${params.type}, ${params.title}, ${params.body}, ${params.actionUrl ?? null})
    RETURNING id, type, title, body, action_url, read, created_at
  `
  return n
}

// ── List ──────────────────────────────────────────────────

export async function listNotifications(
  userId: string,
  opts: { unreadOnly?: boolean; page: number; limit: number },
) {
  const offset = (opts.page - 1) * opts.limit
  const where = opts.unreadOnly
    ? db`WHERE user_id = ${userId} AND read = false`
    : db`WHERE user_id = ${userId}`

  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM notifications ${where}`
  const items = await db`
    SELECT id, type, title, body, action_url, read, read_at, created_at
    FROM notifications ${where}
    ORDER BY created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `
  return { items, total: count, page: opts.page, limit: opts.limit }
}

// ── Mark read ─────────────────────────────────────────────

export async function markRead(userId: string, notificationId: string) {
  const [n] = await db`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING id, read, read_at
  `
  if (!n) throw new AppError('NOTIF_NOT_FOUND', 'Notificación no encontrada', 404)
  return n
}

export async function markAllRead(userId: string) {
  const result = await db`
    UPDATE notifications
    SET read = true, read_at = NOW()
    WHERE user_id = ${userId} AND read = false
    RETURNING id
  `
  return { updated: result.length }
}

// ── Delete ────────────────────────────────────────────────

export async function deleteNotification(userId: string, notificationId: string) {
  const result = await db`
    DELETE FROM notifications
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING id
  `
  if (!result.length) throw new AppError('NOTIF_NOT_FOUND', 'Notificación no encontrada', 404)
  return { deleted: true }
}

// ── Unread count (for badge) ──────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  const [{ count }] = await db`
    SELECT COUNT(*)::int AS count FROM notifications
    WHERE user_id = ${userId} AND read = false
  `
  return count
}

// ── AEAT fiscal calendar alerts ──────────────────────────

// Called by cron 09:00 daily
export async function sendFiscalCalendarAlerts() {
  const today = new Date()
  const dayOfMonth = today.getDate()
  const month = today.getMonth() + 1  // 1-12

  const alerts = getFiscalAlertsForToday(dayOfMonth, month)
  if (!alerts.length) return 0

  // Get all active users
  const users = await db`SELECT id FROM users WHERE is_active = true AND anonymized_at IS NULL`

  let sent = 0
  for (const user of users) {
    for (const alert of alerts) {
      await createNotification({
        userId: user.id,
        type: 'FISCAL_ALERT',
        title: alert.title,
        body: alert.body,
        actionUrl: alert.actionUrl,
      })
      sent++
    }
  }

  console.log(`[notifications] ${sent} fiscal alerts enviadas`)
  return sent
}

function getFiscalAlertsForToday(day: number, month: number): Array<{ title: string; body: string; actionUrl?: string }> {
  const alerts: Array<{ title: string; body: string; actionUrl?: string }> = []

  // Recordatorio 7 días antes de vencimientos clave
  // Modelo 303 (IVA trimestral): 20 ene, 20 abr, 20 jul, 20 oct
  const ivaDeadlines = [{ m: 1, d: 20 }, { m: 4, d: 20 }, { m: 7, d: 20 }, { m: 10, d: 20 }]
  for (const dl of ivaDeadlines) {
    if (month === dl.m && day === dl.d - 7) {
      alerts.push({
        title: '⚠️ Modelo 303 — 7 días',
        body: `El plazo para el Modelo 303 (IVA trimestral) vence el día ${dl.d}. Revisa tus facturas emitidas y recibidas.`,
        actionUrl: '/invoices',
      })
    }
  }

  // Modelo 130 (IRPF trimestral): mismas fechas
  for (const dl of ivaDeadlines) {
    if (month === dl.m && day === dl.d - 7) {
      alerts.push({
        title: '⚠️ Modelo 130 — 7 días',
        body: `El plazo para el Modelo 130 (pago fraccionado IRPF) vence el día ${dl.d}.`,
      })
    }
  }

  // Modelo 347 (operaciones con terceros): 28 feb
  if (month === 2 && day === 21) {
    alerts.push({
      title: '⚠️ Modelo 347 — 7 días',
      body: 'El Modelo 347 (operaciones con terceros >3.005,06€) vence el 28 de febrero.',
    })
  }

  return alerts
}

// ── Weekly digest (lunes 08:00) ───────────────────────────

export async function sendWeeklyDigest() {
  const users = await db`SELECT id, email FROM users WHERE is_active = true AND anonymized_at IS NULL`

  let sent = 0
  for (const user of users) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [stats] = await db`
      SELECT
        COUNT(*)::int AS invoice_count,
        COALESCE(SUM(total), 0)::numeric AS total_invoiced
      FROM invoices
      WHERE user_id = ${user.id}
        AND created_at >= ${weekAgo}
        AND status NOT IN ('DRAFT', 'CANCELLED')
    `

    if (!stats?.invoiceCount) continue  // skip users with no activity

    await createNotification({
      userId: user.id,
      type: 'TIP',
      title: '📊 Resumen semanal',
      body: `Esta semana has emitido ${stats.invoiceCount} factura(s) por un total de ${Number(stats.totalInvoiced).toFixed(2)} €.`,
      actionUrl: '/dashboard',
    })
    sent++
  }

  console.log(`[notifications] ${sent} resúmenes semanales enviados`)
  return sent
}
