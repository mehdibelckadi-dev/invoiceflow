import type { FastifyPluginAsync } from 'fastify'
import {
  RegisterSchema, LoginSchema, RefreshSchema,
  ForgotPasswordSchema, ResetPasswordSchema, VerifyEmailSchema,
} from './auth.schema.js'
import {
  register, login, verifyEmail, forgotPassword,
  resetPassword, logout, rotateRefreshToken,
} from './auth.service.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import { db } from '../../db.js'

const authRoutes: FastifyPluginAsync = async (app) => {

  // POST /auth/register
  app.post('/register', async (req, reply) => {
    const dto = RegisterSchema.parse(req.body)
    const { user } = await register(dto)
    return reply.status(201).send({
      message: 'Cuenta creada. Verifica tu email para activarla.',
      user: { id: user.id, email: user.email, name: user.name },
    })
  })

  // POST /auth/login
  app.post('/login', async (req, reply) => {
    const dto = LoginSchema.parse(req.body)
    const meta = { userAgent: req.headers['user-agent'], ip: req.ip }
    const { user, refreshToken } = await login(dto, meta)

    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, plan: user.plan },
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    return reply.status(200).send({ token: accessToken, refreshToken, user })
  })

  // POST /auth/refresh
  app.post('/refresh', async (req) => {
    const { refresh_token: token } = RefreshSchema.parse(req.body)

    const meta = { userAgent: req.headers['user-agent'], ip: req.ip }
    const { userId, newRefreshToken } = await rotateRefreshToken(token, meta)

    const [user] = await db`SELECT id, email, plan FROM users WHERE id = ${userId} LIMIT 1`
    if (!user) throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404)

    const accessToken = app.jwt.sign(
      { sub: user.id, email: user.email, plan: user.plan },
      { expiresIn: env.JWT_EXPIRES_IN },
    )

    return { token: accessToken, refreshToken: newRefreshToken }
  })

  // POST /auth/logout
  app.post('/logout', async (req) => {
    const body = RefreshSchema.safeParse(req.body)
    if (body.success) await logout(body.data.refresh_token)
    return { message: 'Sesión cerrada' }
  })

  // GET /auth/verify-email?token=xxx
  app.get('/verify-email', async (req) => {
    const { token } = VerifyEmailSchema.parse(req.query)
    await verifyEmail(token)
    return { message: 'Email verificado correctamente' }
  })

  // POST /auth/forgot-password
  app.post('/forgot-password', async (req) => {
    const { email } = ForgotPasswordSchema.parse(req.body)
    await forgotPassword(email)
    return { message: 'Si el email existe, recibirás las instrucciones en breve.' }
  })

  // POST /auth/reset-password
  app.post('/reset-password', async (req) => {
    const { token, password } = ResetPasswordSchema.parse(req.body)
    await resetPassword(token, password)
    return { message: 'Contraseña actualizada' }
  })

  // GET /auth/me
  app.get('/me', {
    preHandler: [async (req) => {
      try { await req.jwtVerify() } catch {
        throw new AppError('UNAUTHORIZED', 'No autenticado', 401)
      }
    }],
  }, async (req) => {
    const payload = req.user as { sub: string }
    const [user] = await db`
      SELECT id, email, display_name, email_verified, totp_enabled, created_at
      FROM users WHERE id = ${payload.sub} LIMIT 1
    `
    if (!user) throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404)
    return user
  })
}

export default authRoutes
