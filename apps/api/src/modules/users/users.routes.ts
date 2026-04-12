import type { FastifyPluginAsync } from 'fastify'
import { UpdateFiscalProfileSchema, UpdateProfileSchema } from './users.schema.js'
import { getUserById, updateProfile, updateFiscalProfile, exportUserData, anonymizeUser } from './users.service.js'
import { jwtAuthHook } from '../../shared/jwt-auth.hook.js'
import { AppError } from '../../shared/errors.js'

const usersRoutes: FastifyPluginAsync = async (app) => {

  // Todas las rutas requieren auth
  app.addHook('preHandler', jwtAuthHook)

  const userId = (req: any) => (req.user as { sub: string }).sub

  // GET /users/me
  app.get('/me', async (req) => getUserById(userId(req)))

  // PATCH /users/me
  app.patch('/me', async (req) => {
    const dto = UpdateProfileSchema.parse(req.body)
    return updateProfile(userId(req), dto)
  })

  // GET /users/me/fiscal-profile
  app.get('/me/fiscal-profile', async (req) => {
    const user = await getUserById(userId(req))
    return {
      nif: user.nif,
      nombre_fiscal: user.nombreFiscal,
      regimen_iva: user.regimenIva,
      epigrafe_iae: user.epigrafaIae,
      domicilio: user.domicilio,
      municipio: user.municipio,
      provincia: user.provincia,
      cod_postal: user.codPostal,
      pais: user.pais,
      serie_default: user.serieDefault,
    }
  })

  // PATCH /users/me/fiscal-profile
  app.patch('/me/fiscal-profile', async (req) => {
    const dto = UpdateFiscalProfileSchema.parse(req.body)
    return updateFiscalProfile(userId(req), dto)
  })

  // GET /users/me/export  — RGPD portabilidad
  app.get('/me/export', async (req) => exportUserData(userId(req)))

  // DELETE /users/me  — RGPD anonimización
  app.delete('/me', async (req, reply) => {
    const body = req.body as { confirm?: string }
    if (body?.confirm !== 'ELIMINAR') {
      throw new AppError('CONFIRM_REQUIRED', 'Envía { confirm: "ELIMINAR" } para confirmar', 400)
    }
    await anonymizeUser(userId(req))
    return reply.status(200).send({ message: 'Cuenta eliminada. Los registros fiscales se conservan por obligación legal.' })
  })
}

export default usersRoutes
