import { createHash } from 'crypto'
import { db } from '../../db.js'
import { redis } from '../../redis.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import { verifactuQueue } from './verifactu.queue.js'

// ── Hash SHA-256 encadenado (RD 1007/2023) ───────────────

function buildHashContent(record: {
  nif: string
  numero_completo: string
  fecha_emision: string
  total: number
  prev_hash: string | null
}): string {
  // Formato según RD 1007/2023 Art. 13
  return [
    record.nif,
    record.numero_completo,
    record.fecha_emision,
    record.total.toFixed(2),
    record.prev_hash ?? '',
  ].join('|')
}

export function computeVerifactuHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').toUpperCase()
}

// ── XML Verifactu (RD 1007/2023) ─────────────────────────

function buildVerifactuXml(params: {
  nif: string
  nombre_fiscal: string
  invoice: Record<string, unknown>
  hash: string
  prev_hash: string | null
}): string {
  const { nif, nombre_fiscal, invoice, hash, prev_hash } = params

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacion.xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <sum:RegFactuSistemaFacturacion>
      <sum:Cabecera>
        <sum:ObligadoEmision>
          <sum:NombreRazon>${escapeXml(nombre_fiscal)}</sum:NombreRazon>
          <sum:NIF>${nif}</sum:NIF>
        </sum:ObligadoEmision>
      </sum:Cabecera>
      <sum:RegistroFactura>
        <sum:RegistroAlta>
          <sum:IDVersion>1.0</sum:IDVersion>
          <sum:IDFactura>
            <sum:IDEmisorFactura>${nif}</sum:IDEmisorFactura>
            <sum:NumSerieFactura>${invoice.numero_completo}</sum:NumSerieFactura>
            <sum:FechaExpedicionFactura>${invoice.fecha_emision}</sum:FechaExpedicionFactura>
          </sum:IDFactura>
          <sum:NombreRazonEmisor>${escapeXml(nombre_fiscal)}</sum:NombreRazonEmisor>
          <sum:TipoFactura>F1</sum:TipoFactura>
          <sum:CuotaTotal>${Number(invoice.iva_importe).toFixed(2)}</sum:CuotaTotal>
          <sum:ImporteTotal>${Number(invoice.total).toFixed(2)}</sum:ImporteTotal>
          <sum:Encadenamiento>
            ${prev_hash
              ? `<sum:RegistroAnterior><sum:Huella>${prev_hash}</sum:Huella></sum:RegistroAnterior>`
              : '<sum:PrimerRegistro>S</sum:PrimerRegistro>'
            }
          </sum:Encadenamiento>
          <sum:SistemaInformatico>
            <sum:NombreRazon>Lefse</sum:NombreRazon>
            <sum:NIF>LEFSE_NIF_PLACEHOLDER</sum:NIF>
            <sum:IdSistemaInformatico>LEFSE_001</sum:IdSistemaInformatico>
            <sum:Version>1.0</sum:Version>
            <sum:NumeroInstalacion>001</sum:NumeroInstalacion>
            <sum:TipoUsoPosibleSoloVerifactu>S</sum:TipoUsoPosibleSoloVerifactu>
            <sum:TipoUsoPosibleMultiOT>N</sum:TipoUsoPosibleMultiOT>
            <sum:IndicadorMultiplesOT>N</sum:IndicadorMultiplesOT>
          </sum:SistemaInformatico>
          <sum:FechaHoraHusoGenRegistro>${new Date().toISOString()}</sum:FechaHoraHusoGenRegistro>
          <sum:HuellaRegistro>${hash}</sum:HuellaRegistro>
        </sum:RegistroAlta>
      </sum:RegistroFactura>
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// ── Seal invoice ──────────────────────────────────────────

export async function sealInvoice(userId: string, invoiceId: string) {
  // 1. Verificar factura
  const [invoice] = await db`
    SELECT i.*, fp.nif, fp.nombre_fiscal
    FROM invoices i
    JOIN user_fiscal_profiles fp ON fp.user_id = i.user_id
    WHERE i.id = ${invoiceId} AND i.user_id = ${userId}
  `
  if (!invoice) throw new AppError('INVOICE_NOT_FOUND', 'Factura no encontrada', 404)
  if (invoice.status !== 'DRAFT') {
    throw new AppError('INVOICE_NOT_SEALABLE', `Estado actual: ${invoice.status}. Solo DRAFT puede sellarse.`, 400)
  }
  if (!invoice.nif) {
    throw new AppError('NIF_REQUIRED', 'Configura tu NIF antes de sellar facturas', 400)
  }

  // 2. Marcar como PENDING_SEAL
  await db`UPDATE invoices SET status = 'PENDING_SEAL', updated_at = NOW() WHERE id = ${invoiceId}`

  // 3. Encolar en BullMQ (procesamiento async)
  await verifactuQueue.add('submit', { invoiceId, userId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  })

  return { status: 'PENDING_SEAL', message: 'Sellado iniciado. Recibirás notificación al completarse.' }
}

// ── Proceso de sellado (ejecutado por worker) ─────────────

export async function processVerifactuSubmit(invoiceId: string, userId: string) {
  const [invoice] = await db`
    SELECT i.*, fp.nif, fp.nombre_fiscal
    FROM invoices i
    JOIN user_fiscal_profiles fp ON fp.user_id = i.user_id
    WHERE i.id = ${invoiceId}
  `

  // Obtener hash del registro anterior (encadenamiento)
  const [lastRecord] = await db`
    SELECT hash_registro FROM verifactu.verifactu_records
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `
  const prevHash = lastRecord?.hashRegistro ?? null

  // Calcular hash
  const hashContent = buildHashContent({
    nif: invoice.nif,
    numero_completo: invoice.numeroCompleto,
    fecha_emision: invoice.fechaEmision.toISOString().slice(0, 10),
    total: parseFloat(invoice.total),
    prev_hash: prevHash,
  })
  const hash = computeVerifactuHash(hashContent)

  // Generar XML
  const xml = buildVerifactuXml({
    nif: invoice.nif,
    nombre_fiscal: invoice.nombreFiscal,
    invoice,
    hash,
    prev_hash: prevHash,
  })

  // Insertar registro (antes de enviar a AEAT — para garantizar inmutabilidad local)
  const [record] = await db`
    INSERT INTO verifactu.verifactu_records (
      invoice_id, user_id, xml_payload,
      hash_registro, hash_registro_anterior, aeat_status
    ) VALUES (
      ${invoiceId}, ${userId}, ${xml},
      ${hash}, ${prevHash}, 'SIGNING'
    )
    RETURNING id
  `

  // Firmar con Uanataca eIDAS
  let signatureId: string
  try {
    signatureId = await signWithUanataca(xml, record.id)
  } catch (err) {
    // El trigger impide UPDATE, pero necesitamos manejar el error sin modificar el record
    // En producción: alertar al equipo, reintentar con nuevo record
    throw new AppError('SIGNATURE_FAILED', 'Error al firmar con eIDAS', 500)
  }

  // Enviar a AEAT
  let aeatStatus: string
  let aeatResponseCode: string | null = null
  let aeatResponseMsg: string | null = null

  try {
    const aeatResponse = await submitToAeat(xml)
    aeatStatus = aeatResponse.accepted ? 'ACCEPTED' : 'REJECTED'
    aeatResponseCode = aeatResponse.code
    aeatResponseMsg = aeatResponse.message
  } catch {
    aeatStatus = 'ERROR'
  }

  // Actualizar invoice status
  const invoiceStatus = aeatStatus === 'ACCEPTED' ? 'SEALED' : 'DRAFT'
  await db`
    UPDATE invoices SET
      status = ${invoiceStatus},
      verifactu_id = ${record.id},
      sealed_at = ${aeatStatus === 'ACCEPTED' ? new Date() : null},
      updated_at = NOW()
    WHERE id = ${invoiceId}
  `

  if (aeatStatus === 'ACCEPTED') {
    // Limpiar cache plan (para estadísticas)
    await redis.del(`plan:${userId}`)
    // TODO: notificar usuario (Paso 10)
  }

  return { status: aeatStatus, hash, recordId: record.id }
}

// ── Uanataca eIDAS (stub — completar con SDK real) ────────

async function signWithUanataca(xml: string, recordId: string): Promise<string> {
  // TODO: integrar SDK Uanataca
  // POST https://api.uanataca.com/api/v1/sign
  // Headers: Authorization: Bearer ${env.UANATACA_API_KEY}
  // Body: { certificate_id, content: base64(xml), format: 'XADES' }
  // Response: { signature_id, timestamp }
  console.log(`[Uanataca stub] Firmando record ${recordId}`)
  return `sig_stub_${recordId}`
}

// ── AEAT Verifactu (stub — completar con SOAP real) ───────

async function submitToAeat(xml: string): Promise<{ accepted: boolean; code: string; message: string }> {
  // TODO: POST SOAP a env.AEAT_VERIFACTU_URL
  // Headers: Content-Type: text/xml; charset=UTF-8
  // Body: xml firmado
  console.log('[AEAT stub] Enviando XML Verifactu (sandbox)')
  return { accepted: true, code: '0000', message: 'Correcto' }
}

// ── Status + Audit trail ──────────────────────────────────

export async function getVerifactuStatus(userId: string, recordId: string) {
  const [record] = await db`
    SELECT id, aeat_status, aeat_response_code, aeat_response_msg,
           aeat_submitted_at, aeat_accepted_at, created_at
    FROM verifactu.verifactu_records
    WHERE id = ${recordId} AND user_id = ${userId}
  `
  if (!record) throw new AppError('RECORD_NOT_FOUND', 'Registro Verifactu no encontrado', 404)
  return record
}

export async function getAuditTrail(userId: string, invoiceId: string) {
  const records = await db`
    SELECT id, aeat_status, hash_registro, hash_registro_anterior,
           signature_id, aeat_submitted_at, aeat_accepted_at, created_at
    FROM verifactu.verifactu_records
    WHERE invoice_id = ${invoiceId} AND user_id = ${userId}
    ORDER BY created_at ASC
  `
  return records
}
