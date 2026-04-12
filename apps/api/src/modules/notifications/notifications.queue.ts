import { Queue, Worker } from 'bullmq'
import { redis } from '../../redis.js'
import { sendFiscalCalendarAlerts, sendWeeklyDigest } from './notifications.service.js'

export const notificationsQueue = new Queue('notifications', {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 3, removeOnFail: 10 },
})

export const notificationsWorker = new Worker(
  'notifications',
  async (job) => {
    if (job.name === 'fiscal-alerts') return sendFiscalCalendarAlerts()
    if (job.name === 'weekly-digest') return sendWeeklyDigest()
  },
  { connection: redis },
)

notificationsWorker.on('failed', (job, err) => {
  console.error(`[notifications] Job ${job?.id} (${job?.name}) failed:`, err.message)
})

// ── Recurring jobs (registered on app startup) ────────────

export async function scheduleNotificationJobs() {
  // Fiscal calendar check — 09:00 every day
  await notificationsQueue.add(
    'fiscal-alerts',
    {},
    { repeat: { pattern: '0 9 * * *' } },
  )

  // Weekly digest — Monday 08:00
  await notificationsQueue.add(
    'weekly-digest',
    {},
    { repeat: { pattern: '0 8 * * 1' } },
  )

  console.log('[notifications] Recurring jobs scheduled')
}
