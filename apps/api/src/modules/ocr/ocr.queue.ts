import { Queue, Worker } from 'bullmq'
import { redis } from '../../redis.js'
import { processOcrJob, cleanupExpiredOcrFiles } from './ocr.service.js'

export const ocrQueue = new Queue('ocr', { connection: redis })

export const ocrWorker = new Worker(
  'ocr',
  async (job) => {
    const { jobId, userId, r2Key, mimeType } = job.data
    return processOcrJob(jobId, userId, r2Key, mimeType)
  },
  { connection: redis, concurrency: 5 },
)

// Cron: cleanup imágenes expiradas (02:00 diario)
export const ocrCleanupQueue = new Queue('ocr-cleanup', {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 1, removeOnFail: 5 },
})

export const ocrCleanupWorker = new Worker(
  'ocr-cleanup',
  async () => cleanupExpiredOcrFiles(),
  { connection: redis },
)

ocrWorker.on('failed', (job, err) => {
  console.error(`[ocr] Job ${job?.id} failed:`, err.message)
})
