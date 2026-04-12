import { createHmac, timingSafeEqual, randomUUID } from 'crypto'
import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import { ocrQueue } from '../ocr/ocr.queue.js'
import { incrementUsage, checkPlanLimitProgrammatic } from '../billing/plan-guard.js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

// ── Verificar firma Mailgun ───────────────────────────────

export function verifyMailgunSignature(params: {
  timestamp: string
  token: string
  signature: string
}): boolean {
  const value = params.timestamp + params.token
  const expected = createHmac('sha256', env.MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(value)
    .digest('hex')

  const expectedBuf = Buffer.from(expected, 'hex')
  const signatureBuf = Buffer.from(params.signature, 'hex')

  if (expectedBuf.length !== signatureBuf.length) return false
  return timingSafeEqual(expectedBuf, signatureBuf)
}

// ── Identificar usuario por {hash}@inbox.lefse.io ────────

async function getUserByInboxHash(to: string): Promise<string | null> {
  // Extraer hash del destinatario: abc123@inbox.lefse.io → abc123
  const match = to.match(/^([a-f0-9]{16})@inbox\.lefse\.io$/i)
  if (!match) return null

  const hash = match[1].toLowerCase()
  const [user] = await db`
    SELECT id FROM users WHERE inbox_hash = ${hash} AND is_active = true AND anonymized_at IS NULL
  `
  return user?.id ?? null
}

// ── Procesar webhook Mailgun ──────────────────────────────

export async function processInboundEmail(payload: Record<string, any>) {
  const to: string = payload['To'] ?? payload['to'] ?? ''
  const from: string = payload['From'] ?? payload['from'] ?? ''
  const subject: string = payload['Subject'] ?? payload['subject'] ?? ''
  const mailgunId: string = payload['Message-Id'] ?? payload['message-id'] ?? ''

  // Idempotencia
  if (mailgunId) {
    const [existing] = await db`
      SELECT id FROM email_inbound_items WHERE mailgun_id = ${mailgunId}
    `
    if (existing) return { status: 'duplicate' }
  }

  // Identificar usuario
  const userId = await getUserByInboxHash(to)
  if (!userId) {
    console.warn(`[email-inbound] Usuario no encontrado para: ${to}`)
    return { status: 'user_not_found' }
  }

  // Verificar límite del plan
  const blocked = await checkPlanLimitProgrammatic(userId, 'email_inbound')
  if (blocked) return { status: 'plan_limit_exceeded' }

  // Insertar item
  const attachments = parseAttachments(payload)
  const [item] = await db`
    INSERT INTO email_inbound_items (user_id, from_email, from_name, subject, mailgun_id, attachments)
    VALUES (
      ${userId},
      ${extractEmail(from)},
      ${extractName(from)},
      ${subject},
      ${mailgunId || null},
      ${JSON.stringify(attachments)}
    )
    RETURNING id
  `

  // Procesar adjuntos
  await processAttachments(item.id, userId, attachments)
  await incrementUsage(userId, 'email_inbound')

  return { status: 'processing', itemId: item.id }
}

function parseAttachments(payload: Record<string, any>): Array<{ filename: string; mimetype: string; url: string }> {
  const count = parseInt(payload['attachment-count'] ?? '0', 10)
  const attachments = []
  for (let i = 1; i <= count; i++) {
    const name = payload[`attachment-${i}`]?.name ?? `attachment-${i}`
    const mime = payload[`attachment-${i}`]?.content_type ?? 'application/octet-stream'
    const url = payload[`attachment-${i}`]?.url ?? ''
    attachments.push({ filename: name, mimetype: mime, url })
  }
  return attachments
}

async function processAttachments(
  itemId: string,
  userId: string,
  attachments: Array<{ filename: string; mimetype: string; url: string }>,
) {
  if (attachments.length === 0) {
    await db`UPDATE email_inbound_items SET status = 'PENDING_REVIEW', updated_at = NOW() WHERE id = ${itemId}`
    return
  }

  for (const att of attachments) {
    const isXml = att.filename.toLowerCase().endsWith('.xml') || att.mimetype === 'application/xml'
    const isPdf = att.mimetype === 'application/pdf'

    if (isXml) {
      // Factura-e XML → parser directo
      await parseFacturaEXml(itemId, userId, att.url)
    } else if (isPdf) {
      // PDF → upload to R2 → OCR pipeline (same flow as manual upload)
      const buffer = await fetchAttachment(att.url)
      const r2Key = `ocr/${userId}/${randomUUID()}-${att.filename}`
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      await s3.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: buffer,
        ContentType: att.mimetype,
        Metadata: { userId, expiresAt: expiresAt.toISOString() },
      }))

      const [job] = await db`
        INSERT INTO ocr_jobs (user_id, r2_key, original_name, mime_type, file_size, r2_expires_at)
        VALUES (${userId}, ${r2Key}, ${att.filename}, ${att.mimetype}, ${buffer.length}, ${expiresAt})
        RETURNING id
      `

      await ocrQueue.add('process', { jobId: job.id, userId, r2Key, mimeType: att.mimetype }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      })

      // Link OCR job to inbox item
      await db`UPDATE email_inbound_items SET status = 'PROCESSING', updated_at = NOW() WHERE id = ${itemId}`
    }
  }
}

async function parseFacturaEXml(itemId: string, userId: string, url: string) {
  // TODO: implementar parser completo Factura-e (XSD validación + extracción campos)
  // Por ahora: crear draft con estado PENDING_REVIEW
  await db`
    UPDATE email_inbound_items
    SET status = 'PENDING_REVIEW', updated_at = NOW()
    WHERE id = ${itemId}
  `
}

async function fetchAttachment(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString('base64')}` },
  })
  if (!res.ok) throw new AppError('ATTACHMENT_FETCH_ERROR', 'Error descargando adjunto', 502)
  return Buffer.from(await res.arrayBuffer())
}

function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/)
  return match ? match[1] : from.trim()
}

function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*</)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : ''
}

// ── Inbox CRUD ────────────────────────────────────────────

export async function listInboxItems(userId: string, opts: { status?: string; page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit
  const where = opts.status
    ? db`WHERE user_id = ${userId} AND status = ${opts.status}`
    : db`WHERE user_id = ${userId}`

  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM email_inbound_items ${where}`
  const items = await db`
    SELECT id, from_email, from_name, subject, status, received_at, draft_invoice_id
    FROM email_inbound_items ${where}
    ORDER BY received_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `
  return { items, total: count, page: opts.page, limit: opts.limit }
}

export async function approveInboxItem(userId: string, itemId: string) {
  const [item] = await db`
    SELECT * FROM email_inbound_items WHERE id = ${itemId} AND user_id = ${userId}
  `
  if (!item) throw new AppError('ITEM_NOT_FOUND', 'Item no encontrado', 404)
  if (item.status !== 'PENDING_REVIEW') {
    throw new AppError('ITEM_NOT_REVIEWABLE', 'Solo items PENDING_REVIEW pueden aprobarse', 400)
  }

  const [updated] = await db`
    UPDATE email_inbound_items SET status = 'APPROVED', reviewed_at = NOW(), updated_at = NOW()
    WHERE id = ${itemId} RETURNING *
  `
  return updated
}

export async function rejectInboxItem(userId: string, itemId: string) {
  const [item] = await db`
    SELECT id, status FROM email_inbound_items WHERE id = ${itemId} AND user_id = ${userId}
  `
  if (!item) throw new AppError('ITEM_NOT_FOUND', 'Item no encontrado', 404)

  const [updated] = await db`
    UPDATE email_inbound_items SET status = 'REJECTED', reviewed_at = NOW(), updated_at = NOW()
    WHERE id = ${itemId} RETURNING id, status
  `
  return updated
}
