import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import { checkPlanLimit, incrementUsage } from '../billing/plan-guard.js'
import { chatStream, listConversations, getConversationMessages, deleteConversation } from './ai.service.js'

const aiRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', jwtAuthHook)

  const uid = (req: any) => (req.user as { sub: string }).sub

  // POST /ai/chat — SSE streaming
  app.post('/chat', { preHandler: [checkPlanLimit('ai_query')] }, async (req, reply) => {
    const { message, conversationId } = req.body as { message: string; conversationId?: string }

    if (!message?.trim()) throw app.httpErrors.badRequest('message requerido')

    const convId = conversationId ?? randomUUID()
    const userId = uid(req)

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Conversation-Id', convId)
    reply.raw.flushHeaders()

    try {
      for await (const chunk of chatStream(userId, convId, message)) {
        reply.raw.write(chunk)
      }
    } catch (err: any) {
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
    } finally {
      reply.raw.end()
      await incrementUsage(userId, 'ai_query')
    }

    return reply
  })

  // GET /ai/conversations
  app.get('/conversations', async (req) => {
    return listConversations(uid(req))
  })

  // GET /ai/conversations/:id
  app.get('/conversations/:id', async (req) => {
    const { id } = req.params as { id: string }
    return getConversationMessages(uid(req), id)
  })

  // DELETE /ai/conversations/:id
  app.delete('/conversations/:id', async (req) => {
    const { id } = req.params as { id: string }
    return deleteConversation(uid(req), id)
  })
}

export default aiRoutes
