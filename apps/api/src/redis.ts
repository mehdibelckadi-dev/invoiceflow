import { Redis } from 'ioredis'
import { env } from './config.js'

// maxRetriesPerRequest must be null for BullMQ workers
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  enableReadyCheck: false,
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})
