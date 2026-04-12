import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import {
  processInboundEmail, verifyMailgunSignature,
  listInboxItems, approveInboxItem, rejectInboxItem,
} from './email-inbound.service.js'
import { AppError } from '../../shared/errors.js'

const emailInboundRoutes: FastifyPluginAsync = async (app) => {

  // POST /webhooks/email-inbound (sin auth — firmado por Mailgun)
  // Registrado desde app.ts en /webhooks, no en /inbox
  app.post('/webhook', { config: { rawBody: true } }, async (req, reply) => {
    const body = req.body as Record<string, any>
    const sig = body['signature'] ?? {}

    const valid = verifyMailgunSignature({
      timestamp: sig.timestamp ?? '',
      token: sig.token ?? '',
      signature: sig.signature ?? '',
    })

    if (!valid) throw new AppError('INVALID_SIGNATURE', 'Firma Mailgun inválida', 401)

    const result = await processInboundEmail(body['event-data'] ?? body)
    return reply.status(200).send(result)
  })

  // Rutas autenticadas del inbox
  app.register(async (inbox) => {
    inbox.addHook('preHandler', jwtAuthHook)

    const uid = (req: any) => (req.user as { sub: string }).sub

    const ListSchema = z.object({
      status: z.enum(['PROCESSING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ERROR']).optional(),
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })

    // GET /inbox
    inbox.get('/', async (req) => {
      const opts = ListSchema.parse(req.query)
      return listInboxItems(uid(req), opts)
    })

    // POST /inbox/:id/approve
    inbox.post('/:id/approve', async (req) => {
      const { id } = req.params as { id: string }
      return approveInboxItem(uid(req), id)
    })

    // POST /inbox/:id/reject
    inbox.post('/:id/reject', async (req) => {
      const { id } = req.params as { id: string }
      return rejectInboxItem(uid(req), id)
    })
  })
}

export default emailInboundRoutes
