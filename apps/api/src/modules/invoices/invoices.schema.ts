import { z } from 'zod'
import { isValidNif } from '@lefse/shared'

const InvoiceItemSchema = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().positive().multipleOf(0.001),
  precio_unitario: z.number().nonnegative().multipleOf(0.01),
  iva_porcentaje: z.union([z.literal(0), z.literal(4), z.literal(10), z.literal(21)]).default(21),
  irpf_porcentaje: z.union([z.literal(0), z.literal(2), z.literal(7), z.literal(15)]).default(0),
  posicion: z.number().int().positive().optional(),
})

export const CreateInvoiceSchema = z.object({
  cliente_nombre: z.string().min(1).max(255),
  cliente_nif: z.string().refine(v => !v || isValidNif(v), 'NIF cliente inválido').optional(),
  cliente_email: z.string().email().optional(),
  cliente_domicilio: z.string().optional(),
  fecha_emision: z.string().date().optional(),
  fecha_vencimiento: z.string().date().optional(),
  serie: z.string().max(10).optional(),
  concepto: z.string().optional(),
  notas: z.string().optional(),
  items: z.array(InvoiceItemSchema).min(1).max(100),
})

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'Sin cambios'
)

export const ListInvoicesSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_SEAL', 'SEALED', 'SENT', 'PAID', 'VOID']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>
export type InvoiceItemDto = z.infer<typeof InvoiceItemSchema>
