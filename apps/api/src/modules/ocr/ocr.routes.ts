import type { FastifyPluginAsync } from 'fastify'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import { checkPlanLimit, incrementUsage } from '../billing/plan-guard.js'
import { uploadOcrFile, getOcrResult } from './ocr.service.js'

const ocrRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', jwtAuthHook)

  const uid = (req: any) => (req.user as { sub: string }).sub

  // POST /ocr/upload
  app.post('/upload', { preHandler: [checkPlanLimit('ocr')] }, async (req, reply) => {
    const data = await req.file()
    if (!data) throw app.httpErrors.badRequest('Archivo requerido')

    const buffer = await data.toBuffer()
    const result = await uploadOcrFile(uid(req), {
      filename: data.filename,
      mimetype: data.mimetype,
      buffer,
    })

    await incrementUsage(uid(req), 'ocr')
    return reply.status(202).send(result)
  })

  // GET /ocr/result/:jobId
  app.get('/result/:jobId', async (req) => {
    const { jobId } = req.params as { jobId: string }
    return getOcrResult(uid(req), jobId)
  })
}

export default ocrRoutes
