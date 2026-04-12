import { Queue, Worker } from 'bullmq'
import { redis } from '../../redis.js'
import { processVerifactuSubmit } from './verifactu.service.js'

export const verifactuQueue = new Queue('verifactu', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
})

export const verifactuWorker = new Worker(
  'verifactu',
  async (job) => {
    const { invoiceId, userId } = job.data
    return processVerifactuSubmit(invoiceId, userId)
  },
  {
    connection: redis,
    concurrency: 5,
  },
)

verifactuWorker.on('failed', (job, err) => {
  console.error(`[verifactu] Job ${job?.id} failed:`, err.message)
})
