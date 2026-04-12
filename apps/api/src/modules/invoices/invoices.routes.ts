import type { FastifyPluginAsync } from 'fastify'
import { CreateInvoiceSchema, UpdateInvoiceSchema, ListInvoicesSchema } from './invoices.schema.js'
import {
  listInvoices, getInvoice, createInvoice, updateInvoice,
  deleteInvoice, voidInvoice, markPaid, duplicateInvoice,
} from './invoices.service.js'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import { checkPlanLimit, incrementUsage } from '../billing/plan-guard.js'

const invoicesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', jwtAuthHook)

  const uid = (req: any) => (req.user as { sub: string }).sub

  // GET /invoices
  app.get('/', async (req) => {
    const opts = ListInvoicesSchema.parse(req.query)
    return listInvoices(uid(req), opts)
  })

  // GET /invoices/:id
  app.get('/:id', async (req) => {
    const { id } = req.params as { id: string }
    return getInvoice(uid(req), id)
  })

  // POST /invoices — PlanGuard
  app.post('/', { preHandler: [checkPlanLimit('invoice')] }, async (req, reply) => {
    const dto = CreateInvoiceSchema.parse(req.body)
    const invoice = await createInvoice(uid(req), dto)
    await incrementUsage(uid(req), 'invoice')
    return reply.status(201).send(invoice)
  })

  // PATCH /invoices/:id
  app.patch('/:id', async (req) => {
    const { id } = req.params as { id: string }
    const dto = UpdateInvoiceSchema.parse(req.body)
    return updateInvoice(uid(req), id, dto)
  })

  // DELETE /invoices/:id  (solo DRAFT)
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await deleteInvoice(uid(req), id)
    return reply.status(204).send()
  })

  // POST /invoices/:id/seal  → Paso 6 (Verifactu)
  app.post('/:id/seal', async (req) => {
    const { id } = req.params as { id: string }
    // Delegado al módulo Verifactu — implementado en Paso 6
    const { sealInvoice } = await import('../verifactu/verifactu.service.js')
    return sealInvoice(uid(req), id)
  })

  // POST /invoices/:id/void
  app.post('/:id/void', async (req) => {
    const { id } = req.params as { id: string }
    return voidInvoice(uid(req), id)
  })

  // POST /invoices/:id/mark-paid
  app.post('/:id/mark-paid', async (req) => {
    const { id } = req.params as { id: string }
    return markPaid(uid(req), id)
  })

  // POST /invoices/:id/duplicate — PlanGuard
  app.post('/:id/duplicate', { preHandler: [checkPlanLimit('invoice')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const invoice = await duplicateInvoice(uid(req), id)
    await incrementUsage(uid(req), 'invoice')
    return reply.status(201).send(invoice)
  })
}

export default invoicesRoutes
