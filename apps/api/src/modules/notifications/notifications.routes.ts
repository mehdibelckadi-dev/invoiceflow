import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import {
  listNotifications, markRead, markAllRead,
  deleteNotification, getUnreadCount,
} from './notifications.service.js'

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', jwtAuthHook)

  const uid = (req: any) => (req.user as { sub: string }).sub

  const ListSchema = z.object({
    unreadOnly: z.coerce.boolean().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })

  // GET /notifications
  app.get('/', async (req) => {
    const opts = ListSchema.parse(req.query)
    return listNotifications(uid(req), opts)
  })

  // GET /notifications/unread-count
  app.get('/unread-count', async (req) => {
    const count = await getUnreadCount(uid(req))
    return { count }
  })

  // PATCH /notifications/:id/read
  app.patch('/:id/read', async (req) => {
    const { id } = req.params as { id: string }
    return markRead(uid(req), id)
  })

  // PATCH /notifications/read-all
  app.patch('/read-all', async (req) => {
    return markAllRead(uid(req))
  })

  // DELETE /notifications/:id
  app.delete('/:id', async (req) => {
    const { id } = req.params as { id: string }
    return deleteNotification(uid(req), id)
  })
}

export default notificationsRoutes
