import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { randomUUID } from 'crypto'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const requestId = randomUUID()

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
      details: error.details,
      requestId,
    })
  }

  if (error instanceof ZodError) {
    return reply.status(422).send({
      code: 'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos',
      details: error.flatten().fieldErrors,
      requestId,
    })
  }

  // Fastify errores conocidos (404, 405, etc.)
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      code: 'CLIENT_ERROR',
      message: error.message,
      requestId,
    })
  }

  // Error interno no esperado
  request.log.error({ err: error, requestId }, 'Unhandled error')
  return reply.status(500).send({
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
    requestId,
  })
}
