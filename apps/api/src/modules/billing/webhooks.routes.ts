import type { FastifyPluginAsync } from 'fastify'
import { handleStripeWebhook } from './billing.service.js'

const webhooksRoutes: FastifyPluginAsync = async (app) => {
  // POST /webhooks/stripe — no auth, Stripe signature verification
  app.post('/stripe', { config: { rawBody: true } }, async (req, reply) => {
    const signature = req.headers['stripe-signature'] as string
    if (!signature) throw app.httpErrors.badRequest('stripe-signature header requerido')

    const payload = (req as any).rawBody as Buffer
    const result = await handleStripeWebhook(payload, signature)
    return reply.status(200).send(result)
  })
}

export default webhooksRoutes
