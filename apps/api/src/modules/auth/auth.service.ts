import { randomBytes, createHash, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { db } from '../../db.js'
import { redis } from '../../redis.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import type { RegisterDto, LoginDto } from './auth.schema.js'

const scryptAsync = promisify(scrypt)

// ── Password helpers ──────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${hash.toString('hex')}`
}

async function verifyPassword(stored: string, candidate: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  const candidateHash = (await scryptAsync(candidate, salt, 64)) as Buffer
  const storedHash = Buffer.from(hash, 'hex')
  return timingSafeEqual(candidateHash, storedHash)
}

// ── Inbox hash ────────────────────────────────────────────

function generateInboxHash(): string {
  return randomBytes(8).toString('hex')  // 16 chars hex
}

// ── Email verification token ──────────────────────────────

async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await redis.set(`email_verify:${token}`, userId, 'EX', 60 * 60 * 24)  // 24h
  return token
}

export async function verifyEmailToken(token: string): Promise<string> {
  const userId = await redis.get(`email_verify:${token}`)
  if (!userId) throw new AppError('TOKEN_INVALID', 'Token inválido o expirado', 400)
  await redis.del(`email_verify:${token}`)
  return userId
}

// ── Password reset ────────────────────────────────────────

async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await redis.set(`pwd_reset:${token}`, userId, 'EX', 60 * 60)  // 1h
  return token
}

export async function consumePasswordResetToken(token: string): Promise<string> {
  const userId = await redis.get(`pwd_reset:${token}`)
  if (!userId) throw new AppError('TOKEN_INVALID', 'Token inválido o expirado', 400)
  await redis.del(`pwd_reset:${token}`)
  return userId
}

// ── Refresh token ─────────────────────────────────────────

export async function createRefreshToken(
  userId: string,
  meta: { userAgent?: string; ip?: string },
): Promise<string> {
  const token = randomBytes(48).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7d

  await db`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
    VALUES (${userId}, ${tokenHash}, ${expiresAt}, ${meta.userAgent ?? null}, ${meta.ip ?? null})
  `
  return token
}

export async function rotateRefreshToken(
  token: string,
  meta: { userAgent?: string; ip?: string },
): Promise<{ userId: string; newRefreshToken: string }> {
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const [row] = await db`
    SELECT id, user_id, expires_at, revoked_at
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `

  if (!row) throw new AppError('TOKEN_INVALID', 'Refresh token inválido', 401)
  if (row.revokedAt) throw new AppError('TOKEN_REVOKED', 'Refresh token revocado', 401)
  if (new Date(row.expiresAt) < new Date()) {
    throw new AppError('TOKEN_EXPIRED', 'Refresh token expirado', 401)
  }

  // Rotar: revocar el anterior, emitir nuevo
  await db`
    UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ${row.id}
  `
  const newRefreshToken = await createRefreshToken(row.userId, meta)
  return { userId: row.userId, newRefreshToken }
}

// ── Register ──────────────────────────────────────────────

export async function register(dto: RegisterDto) {
  const existing = await db`SELECT id FROM users WHERE email = ${dto.email} LIMIT 1`
  if (existing.length > 0) {
    throw new AppError('EMAIL_TAKEN', 'El email ya está en uso', 409)
  }

  const passwordHash = await hashPassword(dto.password)
  const inboxHash = generateInboxHash()

  const [user] = await db`
    INSERT INTO users (email, name, password_hash, inbox_hash)
    VALUES (${dto.email}, ${dto.name}, ${passwordHash}, ${inboxHash})
    RETURNING id, email, name, plan, created_at
  `

  // Crear perfil fiscal vacío
  await db`INSERT INTO user_fiscal_profiles (user_id) VALUES (${user.id})`

  const verifyToken = await createEmailVerificationToken(user.id)

  // TODO: enviar email con verifyToken (Resend)

  return { user, verifyToken }
}

// ── Login ─────────────────────────────────────────────────

export async function login(
  dto: LoginDto,
  meta: { userAgent?: string; ip?: string },
) {
  const [user] = await db`
    SELECT id, email, name, plan, password_hash, email_verified,
           totp_enabled, totp_secret, is_active, anonymized_at
    FROM users
    WHERE email = ${dto.email}
    LIMIT 1
  `

  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Credenciales incorrectas', 401)
  if (user.anonymizedAt) throw new AppError('ACCOUNT_DELETED', 'Cuenta eliminada', 403)
  if (!user.isActive) throw new AppError('ACCOUNT_DISABLED', 'Cuenta desactivada', 403)
  if (!user.passwordHash) {
    throw new AppError('USE_OAUTH', 'Esta cuenta usa Google. Inicia sesión con Google.', 400)
  }

  const valid = await verifyPassword(user.passwordHash, dto.password)
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Credenciales incorrectas', 401)

  // 2FA TOTP (si está habilitado)
  if (user.totpEnabled) {
    if (!dto.totp_code) {
      throw new AppError('TOTP_REQUIRED', 'Código 2FA requerido', 400)
    }
    const { authenticator } = await import('otplib')
    const validTotp = authenticator.verify({
      token: dto.totp_code,
      secret: user.totpSecret,
    })
    if (!validTotp) throw new AppError('TOTP_INVALID', 'Código 2FA inválido', 401)
  }

  const refreshToken = await createRefreshToken(user.id, meta)

  await db`
    INSERT INTO audit_log (user_id, action, ip) VALUES (${user.id}, 'USER_LOGIN', ${meta.ip ?? null})
  `

  return {
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
    refreshToken,
  }
}

// ── Verify email ──────────────────────────────────────────

export async function verifyEmail(token: string) {
  const userId = await verifyEmailToken(token)
  await db`UPDATE users SET email_verified = true WHERE id = ${userId}`
  await db`INSERT INTO audit_log (user_id, action) VALUES (${userId}, 'EMAIL_VERIFIED')`
}

// ── Forgot / reset password ───────────────────────────────

export async function forgotPassword(email: string) {
  const [user] = await db`SELECT id FROM users WHERE email = ${email} LIMIT 1`
  if (!user) return  // No revelar si el email existe

  const token = await createPasswordResetToken(user.id)
  // TODO: enviar email con token (Resend)
  return token
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await consumePasswordResetToken(token)
  const passwordHash = await hashPassword(newPassword)
  await db`UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${userId}`
  // Revocar todos los refresh tokens del usuario
  await db`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ${userId} AND revoked_at IS NULL`
  await db`INSERT INTO audit_log (user_id, action) VALUES (${userId}, 'PASSWORD_RESET')`
}

// ── Logout ────────────────────────────────────────────────

export async function logout(refreshToken: string) {
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
  await db`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ${tokenHash}`
}
