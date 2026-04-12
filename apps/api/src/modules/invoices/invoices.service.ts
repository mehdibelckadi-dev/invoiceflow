import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import type { CreateInvoiceDto, InvoiceItemDto } from './invoices.schema.js'

// ── Cálculo IVA/IRPF (ROUND_HALF_UP) ─────────────────────

function roundHalfUp(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round((n + Number.EPSILON) * factor) / factor
}

interface TotalsResult {
  base_imponible: number
  iva_importe: number
  irpf_importe: number
  total: number
}

export function calculateTotals(items: InvoiceItemDto[], invoiceIvaPct?: number, invoiceIrpfPct?: number): TotalsResult {
  let base = 0
  let ivaTotal = 0
  let irpfTotal = 0

  for (const item of items) {
    const subtotal = roundHalfUp(item.cantidad * item.precio_unitario)
    base = roundHalfUp(base + subtotal)
    ivaTotal = roundHalfUp(ivaTotal + subtotal * (item.iva_porcentaje / 100))
    irpfTotal = roundHalfUp(irpfTotal + subtotal * (item.irpf_porcentaje / 100))
  }

  return {
    base_imponible: base,
    iva_importe: ivaTotal,
    irpf_importe: irpfTotal,
    total: roundHalfUp(base + ivaTotal - irpfTotal),
  }
}

// ── Siguiente número de factura ───────────────────────────

async function getNextInvoiceNumber(userId: string, serie: string): Promise<number> {
  // Atomic increment con UPDATE ... RETURNING
  const [fp] = await db`
    UPDATE user_fiscal_profiles
    SET siguiente_num = siguiente_num + 1, updated_at = NOW()
    WHERE user_id = ${userId} AND serie_default = ${serie}
    RETURNING siguiente_num - 1 AS numero
  `
  if (!fp) throw new AppError('FISCAL_PROFILE_MISSING', 'Perfil fiscal no configurado', 400)
  return fp.numero
}

// ── CRUD ──────────────────────────────────────────────────

export async function listInvoices(userId: string, opts: { status?: string; page: number; limit: number }) {
  const offset = (opts.page - 1) * opts.limit
  const where = opts.status
    ? db`WHERE user_id = ${userId} AND status = ${opts.status}`
    : db`WHERE user_id = ${userId}`

  const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM invoices ${where}`
  const items = await db`
    SELECT id, numero_completo, cliente_nombre, cliente_nif,
           status, fecha_emision, total, sealed_at, created_at
    FROM invoices ${where}
    ORDER BY fecha_emision DESC, created_at DESC
    LIMIT ${opts.limit} OFFSET ${offset}
  `
  return { items, total: count, page: opts.page, limit: opts.limit }
}

export async function getInvoice(userId: string, invoiceId: string) {
  const [invoice] = await db`
    SELECT i.*, json_agg(ii.* ORDER BY ii.posicion) AS items
    FROM invoices i
    LEFT JOIN invoice_items ii ON ii.invoice_id = i.id
    WHERE i.id = ${invoiceId} AND i.user_id = ${userId}
    GROUP BY i.id
    LIMIT 1
  `
  if (!invoice) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  return invoice
}

export async function createInvoice(userId: string, dto: CreateInvoiceDto) {
  const [fp] = await db`SELECT serie_default FROM user_fiscal_profiles WHERE user_id = ${userId}`
  if (!fp) throw new AppError('FISCAL_PROFILE_MISSING', 'Configura tu perfil fiscal primero', 400)

  const serie = dto.serie ?? fp.serieDefault ?? 'A'
  const numero = await getNextInvoiceNumber(userId, serie)
  const totals = calculateTotals(dto.items)

  const invoice = await db.begin(async (tx) => {
    const [inv] = await tx`
      INSERT INTO invoices (
        user_id, serie, numero,
        cliente_nombre, cliente_nif, cliente_email, cliente_domicilio,
        fecha_emision, fecha_vencimiento,
        base_imponible, iva_porcentaje, iva_importe,
        irpf_porcentaje, irpf_importe, total,
        concepto, notas
      ) VALUES (
        ${userId}, ${serie}, ${numero},
        ${dto.cliente_nombre}, ${dto.cliente_nif ?? null}, ${dto.cliente_email ?? null},
        ${dto.cliente_domicilio ?? null},
        ${dto.fecha_emision ?? new Date().toISOString().slice(0, 10)},
        ${dto.fecha_vencimiento ?? null},
        ${totals.base_imponible}, ${dto.items[0].iva_porcentaje}, ${totals.iva_importe},
        ${dto.items[0].irpf_porcentaje}, ${totals.irpf_importe}, ${totals.total},
        ${dto.concepto ?? null}, ${dto.notas ?? null}
      )
      RETURNING *
    `

    const itemsToInsert = dto.items.map((item, i) => ({
      invoice_id: inv.id,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      iva_porcentaje: item.iva_porcentaje,
      irpf_porcentaje: item.irpf_porcentaje,
      subtotal: roundHalfUp(item.cantidad * item.precio_unitario),
      posicion: item.posicion ?? i + 1,
    }))

    await tx`INSERT INTO invoice_items ${tx(itemsToInsert)}`

    await tx`
      INSERT INTO audit_log (user_id, action, entity_type, entity_id)
      VALUES (${userId}, 'INVOICE_CREATED', 'invoice', ${inv.id})
    `

    return inv
  })

  return invoice
}

export async function updateInvoice(userId: string, invoiceId: string, dto: Partial<CreateInvoiceDto>) {
  const [existing] = await db`
    SELECT id, status FROM invoices WHERE id = ${invoiceId} AND user_id = ${userId}
  `
  if (!existing) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  if (!['DRAFT'].includes(existing.status)) {
    throw new AppError('INVOICE_NOT_EDITABLE', 'Solo se pueden editar facturas en estado DRAFT', 400)
  }

  const updateData: Record<string, unknown> = {}
  const fields = ['cliente_nombre', 'cliente_nif', 'cliente_email', 'cliente_domicilio',
    'fecha_emision', 'fecha_vencimiento', 'concepto', 'notas'] as const
  for (const f of fields) {
    if (dto[f as keyof typeof dto] !== undefined) updateData[f] = dto[f as keyof typeof dto]
  }

  if (dto.items) {
    const totals = calculateTotals(dto.items)
    Object.assign(updateData, {
      base_imponible: totals.base_imponible,
      iva_importe: totals.iva_importe,
      irpf_importe: totals.irpf_importe,
      total: totals.total,
    })
  }

  const [invoice] = await db`
    UPDATE invoices SET ${db(updateData)}, updated_at = NOW()
    WHERE id = ${invoiceId}
    RETURNING *
  `

  if (dto.items) {
    await db`DELETE FROM invoice_items WHERE invoice_id = ${invoiceId}`
    const itemsToInsert = dto.items.map((item, i) => ({
      invoice_id: invoiceId,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      iva_porcentaje: item.iva_porcentaje,
      irpf_porcentaje: item.irpf_porcentaje,
      subtotal: roundHalfUp(item.cantidad * item.precio_unitario),
      posicion: item.posicion ?? i + 1,
    }))
    await db`INSERT INTO invoice_items ${db(itemsToInsert)}`
  }

  return invoice
}

export async function deleteInvoice(userId: string, invoiceId: string) {
  const [existing] = await db`
    SELECT id, status FROM invoices WHERE id = ${invoiceId} AND user_id = ${userId}
  `
  if (!existing) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  if (existing.status !== 'DRAFT') {
    throw new AppError('INVOICE_NOT_DELETABLE', 'Solo se pueden eliminar facturas DRAFT', 400)
  }
  await db`DELETE FROM invoices WHERE id = ${invoiceId}`
}

export async function voidInvoice(userId: string, invoiceId: string) {
  const [inv] = await db`SELECT id, status FROM invoices WHERE id = ${invoiceId} AND user_id = ${userId}`
  if (!inv) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  if (['VOID', 'DRAFT'].includes(inv.status)) {
    throw new AppError('INVOICE_CANNOT_VOID', `No se puede anular una factura en estado ${inv.status}`, 400)
  }

  const [updated] = await db`
    UPDATE invoices SET status = 'VOID', updated_at = NOW()
    WHERE id = ${invoiceId} RETURNING *
  `
  await db`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id)
    VALUES (${userId}, 'INVOICE_VOIDED', 'invoice', ${invoiceId})
  `
  return updated
}

export async function markPaid(userId: string, invoiceId: string) {
  const [inv] = await db`SELECT id, status FROM invoices WHERE id = ${invoiceId} AND user_id = ${userId}`
  if (!inv) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  if (!['SEALED', 'SENT'].includes(inv.status)) {
    throw new AppError('INVOICE_NOT_PAYABLE', 'Solo SEALED o SENT pueden marcarse como pagadas', 400)
  }
  const [updated] = await db`
    UPDATE invoices SET status = 'PAID', updated_at = NOW() WHERE id = ${invoiceId} RETURNING *
  `
  await db`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id)
    VALUES (${userId}, 'INVOICE_MARKED_PAID', 'invoice', ${invoiceId})
  `
  return updated
}

export async function duplicateInvoice(userId: string, invoiceId: string) {
  const [fp] = await db`SELECT serie_default FROM user_fiscal_profiles WHERE user_id = ${userId}`
  const original = await getInvoice(userId, invoiceId)

  const serie = original.serie ?? fp?.serieDefault ?? 'A'
  const numero = await getNextInvoiceNumber(userId, serie)

  const newInvoice = await db.begin(async (tx) => {
    const [inv] = await tx`
      INSERT INTO invoices (
        user_id, serie, numero,
        cliente_nombre, cliente_nif, cliente_email, cliente_domicilio,
        base_imponible, iva_porcentaje, iva_importe,
        irpf_porcentaje, irpf_importe, total,
        concepto, notas,
        fecha_emision
      ) VALUES (
        ${userId}, ${serie}, ${numero},
        ${original.clienteNombre}, ${original.clienteNif}, ${original.clienteEmail},
        ${original.clienteDomicilio},
        ${original.baseImponible}, ${original.ivaPorcentaje}, ${original.ivaImporte},
        ${original.irpfPorcentaje}, ${original.irpfImporte}, ${original.total},
        ${original.concepto}, ${original.notas},
        ${new Date().toISOString().slice(0, 10)}
      )
      RETURNING *
    `
    if (original.items?.length) {
      const items = original.items.map((item: any) => ({ ...item, id: undefined, invoice_id: inv.id }))
      await tx`INSERT INTO invoice_items ${tx(items)}`
    }
    return inv
  })

  return newInvoice
}
