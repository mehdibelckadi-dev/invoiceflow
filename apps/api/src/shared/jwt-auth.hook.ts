import type { FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from './errors.js'

export async function jwtAuthHook(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    throw new AppError('UNAUTHORIZED', 'Token inválido o expirado', 401)
  }
}
