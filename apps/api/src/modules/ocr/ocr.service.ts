import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import { ocrQueue } from './ocr.queue.js'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
})

// ── Upload ────────────────────────────────────────────────

export async function uploadOcrFile(
  userId: string,
  file: { filename: string; mimetype: string; buffer: Buffer },
) {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedMimes.includes(file.mimetype)) {
    throw new AppError('OCR_INVALID_TYPE', 'Formato no soportado. Usa JPG, PNG, WEBP o PDF.', 400)
  }

  const r2Key = `ocr/${userId}/${randomUUID()}-${file.filename}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24h RGPD

  await s3.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: r2Key,
    Body: file.buffer,
    ContentType: file.mimetype,
    Metadata: { userId, expiresAt: expiresAt.toISOString() },
  }))

  const [job] = await db`
    INSERT INTO ocr_jobs (user_id, r2_key, original_name, mime_type, file_size, r2_expires_at)
    VALUES (${userId}, ${r2Key}, ${file.filename}, ${file.mimetype}, ${file.buffer.length}, ${expiresAt})
    RETURNING id, status, created_at
  `

  await ocrQueue.add('process', { jobId: job.id, userId, r2Key, mimeType: file.mimetype }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 3000 },
  })

  return { jobId: job.id, status: 'PENDING' }
}

// ── Process (ejecutado por worker) ────────────────────────

export async function processOcrJob(jobId: string, userId: string, r2Key: string, mimeType: string) {
  await db`UPDATE ocr_jobs SET status = 'PROCESSING', started_at = NOW() WHERE id = ${jobId}`

  try {
    // Llamar Mindee API
    const result = await callMindeeApi(r2Key, mimeType)

    // Calcular confianza promedio
    const scores = Object.values(result.fields).map((f: any) => f.confidence ?? 0)
    const confidenceAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    // Marcar campos con baja confianza (<0.7)
    const fields = result.fields as Record<string, { confidence?: number; needs_review?: boolean }>
    for (const [key, field] of Object.entries(fields)) {
      if ((field.confidence ?? 1) < 0.7) {
        fields[key].needs_review = true
      }
    }

    await db`
      UPDATE ocr_jobs SET
        status = 'COMPLETED',
        result = ${JSON.stringify(result)},
        confidence_avg = ${confidenceAvg},
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${jobId}
    `

    return result

  } catch (err: any) {
    await db`
      UPDATE ocr_jobs SET
        status = 'FAILED',
        error_msg = ${err.message},
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${jobId}
    `
    throw err
  }
}

// ── Mindee API (EU — Francia) ─────────────────────────────

async function callMindeeApi(r2Key: string, mimeType: string) {
  // Obtener URL presignada de R2
  const url = `${env.R2_PUBLIC_URL}/${r2Key}`

  const res = await fetch(`${env.MINDEE_API_URL}/products/mindee/invoices/v4/predict`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.MINDEE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ document: url }),
  })

  if (!res.ok) {
    throw new AppError('OCR_MINDEE_ERROR', `Mindee error: ${res.status}`, 502)
  }

  const data = await res.json() as any
  const pred = data.document?.inference?.prediction

  return {
    fields: {
      emisor:         { value: pred?.supplier_name?.value,        confidence: pred?.supplier_name?.confidence },
      nif_emisor:     { value: pred?.supplier_company_registrations?.[0]?.value, confidence: 0.8 },
      fecha:          { value: pred?.date?.value,                 confidence: pred?.date?.confidence },
      numero_factura: { value: pred?.invoice_number?.value,       confidence: pred?.invoice_number?.confidence },
      concepto:       { value: pred?.line_items?.[0]?.description, confidence: 0.7 },
      base_imponible: { value: pred?.total_net?.value,            confidence: pred?.total_net?.confidence },
      iva_importe:    { value: pred?.total_tax?.value,            confidence: pred?.total_tax?.confidence },
      total:          { value: pred?.total_amount?.value,         confidence: pred?.total_amount?.confidence },
    },
    raw: pred,
  }
}

// ── Get result ────────────────────────────────────────────

export async function getOcrResult(userId: string, jobId: string) {
  const [job] = await db`
    SELECT id, status, result, confidence_avg, error_msg, invoice_id, created_at, completed_at
    FROM ocr_jobs
    WHERE id = ${jobId} AND user_id = ${userId}
  `
  if (!job) throw new AppError('OCR_JOB_NOT_FOUND', 'Job OCR no encontrado', 404)
  return job
}

// ── Cleanup (cron 02:00) ──────────────────────────────────

export async function cleanupExpiredOcrFiles() {
  const expired = await db`
    SELECT id, r2_key FROM ocr_jobs
    WHERE r2_key IS NOT NULL AND r2_expires_at < NOW()
  `

  let deleted = 0
  for (const job of expired) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: job.r2Key }))
      await db`UPDATE ocr_jobs SET r2_key = NULL, updated_at = NOW() WHERE id = ${job.id}`
      deleted++
    } catch (err) {
      console.error(`[ocr-cleanup] Error eliminando ${job.r2Key}:`, err)
    }
  }

  console.log(`[ocr-cleanup] ${deleted} archivos eliminados`)
  return deleted
}
