import type { FastifyPluginAsync } from 'fastify'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import {
  listPlans, getSubscription, getCurrentUsage,
  createCheckoutSession, createPortalSession,
} from './billing.service.js'

const billingRoutes: FastifyPluginAsync = async (app) => {
  const uid = (req: any) => (req.user as { sub: string }).sub

  // GET /billing/plans — public
  app.get('/plans', async () => listPlans())

  // All routes below require auth
  app.register(async (auth) => {
    auth.addHook('preHandler', jwtAuthHook)

    // GET /billing/subscription
    auth.get('/subscription', async (req) => getSubscription(uid(req)))

    // GET /billing/usage
    auth.get('/usage', async (req) => getCurrentUsage(uid(req)))

    // POST /billing/checkout
    auth.post('/checkout', async (req) => {
      const { priceId, period } = req.body as { priceId: string; period: 'monthly' | 'annual' }
      if (!priceId) throw app.httpErrors.badRequest('priceId requerido')
      return createCheckoutSession(uid(req), priceId, period ?? 'monthly')
    })

    // POST /billing/portal
    auth.post('/portal', async (req) => createPortalSession(uid(req)))
  })
}

export default billingRoutes
