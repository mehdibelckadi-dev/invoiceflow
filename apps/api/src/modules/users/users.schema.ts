import { z } from 'zod'
import { isValidNif } from '@lefse/shared'

export const UpdateFiscalProfileSchema = z.object({
  nif: z.string().refine(isValidNif, 'NIF/NIE/CIF inválido').optional(),
  nombre_fiscal: z.string().min(1).max(255).optional(),
  regimen_iva: z.enum(['GENERAL', 'SIMPLIFICADO', 'RECARGO_EQUIVALENCIA', 'EXENTO']).optional(),
  epigrafe_iae: z.string().max(10).optional(),
  domicilio: z.string().optional(),
  municipio: z.string().max(255).optional(),
  provincia: z.string().max(100).optional(),
  cod_postal: z.string().regex(/^\d{5}$/, 'Código postal inválido').optional(),
  pais: z.string().length(2).default('ES'),
  serie_default: z.string().max(10).optional(),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().optional(),
})

export type UpdateFiscalProfileDto = z.infer<typeof UpdateFiscalProfileSchema>
