import type { FastifyPluginAsync } from 'fastify'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import { getVerifactuStatus, getAuditTrail } from './verifactu.service.js'

const verifactuRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', jwtAuthHook)

  const uid = (req: any) => (req.user as { sub: string }).sub

  // GET /verifactu/status/:id
  app.get('/status/:id', async (req) => {
    const { id } = req.params as { id: string }
    return getVerifactuStatus(uid(req), id)
  })

  // GET /verifactu/audit-trail/:invoiceId
  app.get('/audit-trail/:invoiceId', async (req) => {
    const { invoiceId } = req.params as { invoiceId: string }
    return getAuditTrail(uid(req), invoiceId)
  })
}

export default verifactuRoutes
