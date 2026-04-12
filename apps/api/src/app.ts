import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import sensible from '@fastify/sensible'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { env } from './config.js'
import { db } from './db.js'
import { redis } from './redis.js'
import { errorHandler } from './shared/errors.js'

// Modules
import authRoutes from './modules/auth/auth.routes.js'
import usersRoutes from './modules/users/users.routes.js'
import invoicesRoutes from './modules/invoices/invoices.routes.js'
import verifactuRoutes from './modules/verifactu/verifactu.routes.js'
import ocrRoutes from './modules/ocr/ocr.routes.js'
import emailInboundRoutes from './modules/email-inbound/email-inbound.routes.js'
import aiRoutes from './modules/ai-assistant/ai.routes.js'
import notificationsRoutes from './modules/notifications/notifications.routes.js'
import { scheduleNotificationJobs } from './modules/notifications/notifications.queue.js'
import billingRoutes from './modules/billing/billing.routes.js'
import webhooksRoutes from './modules/billing/webhooks.routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'warn' : 'info',
      transport: env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  // Plugins
  await app.register(cors, {
    origin: env.APP_URL,
    credentials: true,
  })
  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })
  await app.register(sensible)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB
  await app.register(rateLimit, {
    global: false,  // Configurado por ruta
    redis,
  })

  // Error handler global
  app.setErrorHandler(errorHandler)

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    ts: new Date().toISOString(),
    env: env.NODE_ENV,
  }))

  // Routes
  await app.register(authRoutes,          { prefix: '/auth' })
  await app.register(usersRoutes,         { prefix: '/users' })
  await app.register(invoicesRoutes,      { prefix: '/invoices' })
  await app.register(verifactuRoutes,     { prefix: '/verifactu' })
  await app.register(ocrRoutes,           { prefix: '/ocr' })
  await app.register(emailInboundRoutes,  { prefix: '/inbox' })
  await app.register(aiRoutes,            { prefix: '/ai' })
  await app.register(notificationsRoutes, { prefix: '/notifications' })
  await app.register(billingRoutes,       { prefix: '/billing' })
  await app.register(webhooksRoutes,      { prefix: '/webhooks' })

  // Schedule recurring cron jobs (only in production/worker mode)
  if (env.NODE_ENV === 'production') {
    await scheduleNotificationJobs()
  }

  // Cleanup on close
  app.addHook('onClose', async () => {
    await db.end()
    await redis.quit()
  })

  return app
}
