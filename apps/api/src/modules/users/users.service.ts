import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import type { UpdateFiscalProfileDto } from './users.schema.js'

export async function getUserById(userId: string) {
  const [user] = await db`
    SELECT u.id, u.email, u.name, u.plan, u.email_verified,
           u.totp_enabled, u.inbox_hash, u.created_at,
           fp.nif, fp.nombre_fiscal, fp.regimen_iva,
           fp.epigrafe_iae, fp.domicilio, fp.municipio,
           fp.provincia, fp.cod_postal, fp.pais, fp.serie_default
    FROM users u
    LEFT JOIN user_fiscal_profiles fp ON fp.user_id = u.id
    WHERE u.id = ${userId} AND u.anonymized_at IS NULL
    LIMIT 1
  `
  if (!user) throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404)
  return user
}

export async function updateProfile(userId: string, data: { name?: string; avatar_url?: string }) {
  const updates = Object.entries(data).filter(([, v]) => v !== undefined)
  if (updates.length === 0) throw new AppError('NO_CHANGES', 'Sin cambios', 400)

  const [user] = await db`
    UPDATE users
    SET ${db(Object.fromEntries(updates))}, updated_at = NOW()
    WHERE id = ${userId}
    RETURNING id, email, name, plan
  `
  return user
}

export async function updateFiscalProfile(userId: string, dto: UpdateFiscalProfileDto) {
  const updates = Object.entries(dto).filter(([, v]) => v !== undefined)
  if (updates.length === 0) throw new AppError('NO_CHANGES', 'Sin cambios', 400)

  const [fp] = await db`
    UPDATE user_fiscal_profiles
    SET ${db(Object.fromEntries(updates))}, updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING *
  `
  await db`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id)
    VALUES (${userId}, 'FISCAL_PROFILE_UPDATED', 'user_fiscal_profile', ${fp.id})
  `
  return fp
}

export async function exportUserData(userId: string) {
  // RGPD Art. 20 — portabilidad de datos
  const [user] = await db`SELECT * FROM users WHERE id = ${userId}`
  const [fiscalProfile] = await db`SELECT * FROM user_fiscal_profiles WHERE user_id = ${userId}`
  const invoices = await db`SELECT * FROM invoices WHERE user_id = ${userId} ORDER BY created_at DESC`
  const notifications = await db`SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 100`

  return {
    exported_at: new Date().toISOString(),
    user: { ...user, password_hash: '[REDACTED]', totp_secret: '[REDACTED]' },
    fiscal_profile: fiscalProfile,
    invoices,
    notifications_sample: notifications,
  }
}

export async function anonymizeUser(userId: string) {
  // RGPD Art. 17 — derecho al olvido (anonimización, NO borrado físico de datos fiscales)
  const [user] = await db`SELECT plan FROM users WHERE id = ${userId}`
  if (!user) throw new AppError('USER_NOT_FOUND', 'Usuario no encontrado', 404)

  await db.begin(async (tx) => {
    // Anonimizar datos personales
    await tx`
      UPDATE users SET
        email = ${'deleted_' + userId + '@anonymized.lefse.io'},
        name = 'Usuario eliminado',
        password_hash = NULL,
        google_id = NULL,
        totp_secret = NULL,
        totp_enabled = false,
        avatar_url = NULL,
        is_active = false,
        anonymized_at = NOW(),
        updated_at = NOW()
      WHERE id = ${userId}
    `
    await tx`
      UPDATE user_fiscal_profiles SET
        nombre_fiscal = 'Eliminado',
        domicilio = NULL,
        municipio = NULL,
        updated_at = NOW()
      WHERE user_id = ${userId}
    `
    // Revocar tokens
    await tx`
      UPDATE refresh_tokens SET revoked_at = NOW()
      WHERE user_id = ${userId} AND revoked_at IS NULL
    `
    // Audit log
    await tx`
      INSERT INTO audit_log (user_id, action)
      VALUES (${userId}, 'ACCOUNT_ANONYMIZED')
    `
  })
  // NOTA: verifactu_records y audit_log NO se borran (obligación legal)
}
