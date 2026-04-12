'use client'

import { useCallback, useState } from 'react'
import { ocr as ocrApi } from '@/lib/api'

type Phase = 'idle' | 'uploading' | 'polling' | 'done' | 'error'

export default function OcrPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setPhase('uploading')
    setError('')
    setResult(null)

    try {
      const { jobId } = await ocrApi.upload(file)
      setPhase('polling')

      // Poll every 2s up to 60s
      let attempts = 0
      const poll = async () => {
        attempts++
        const job = await ocrApi.result(jobId)
        if (job.status === 'COMPLETED') {
          setResult(job)
          setPhase('done')
        } else if (job.status === 'FAILED') {
          setError(job.errorMsg ?? 'OCR fallido')
          setPhase('error')
        } else if (attempts < 30) {
          setTimeout(poll, 2000)
        } else {
          setError('Tiempo de espera agotado')
          setPhase('error')
        }
      }
      setTimeout(poll, 2000)
    } catch (e: any) {
      setError(e.message)
      setPhase('error')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div style={{ maxWidth: '760px' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        OCR de facturas
      </h1>
      <p style={{ color: '#555', fontSize: '0.875rem', marginBottom: '2rem' }}>
        Sube una imagen o PDF y extraeremos los datos automáticamente.
      </p>

      {/* Drop zone */}
      {(phase === 'idle' || phase === 'error') && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => document.getElementById('ocr-input')?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#FF4D00' : '#1A1A1A'}`,
            borderRadius: '12px',
            padding: '4rem',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
            background: dragOver ? 'rgba(255,77,0,0.05)' : '#111',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⊙</div>
          <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Arrastra tu factura aquí</div>
          <div style={{ fontSize: '0.75rem', color: '#555' }}>JPG, PNG, WEBP o PDF · máx. 10MB</div>
          {error && <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}
        </div>
      )}

      <input
        id="ocr-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Loading states */}
      {phase === 'uploading' && <LoadingCard message="Subiendo archivo..." />}
      {phase === 'polling' && <LoadingCard message="Procesando con OCR..." hint="Esto puede tardar unos segundos." />}

      {/* Result */}
      {phase === 'done' && result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Datos extraídos</h2>
            <button
              onClick={() => { setPhase('idle'); setResult(null) }}
              style={{ fontSize: '0.75rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Nueva subida
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(result.result?.fields ?? {}).map(([key, field]: [string, any]) => (
              <FieldRow
                key={key}
                label={FIELD_LABELS[key] ?? key}
                value={field.value ?? '—'}
                confidence={field.confidence}
                needsReview={field.needs_review}
              />
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#555' }}>
            Confianza promedio: {((result.confidenceAvg ?? 0) * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  )
}

const FIELD_LABELS: Record<string, string> = {
  emisor: 'Emisor',
  nif_emisor: 'NIF Emisor',
  fecha: 'Fecha',
  numero_factura: 'Nº Factura',
  concepto: 'Concepto',
  base_imponible: 'Base imponible',
  iva_importe: 'IVA',
  total: 'Total',
}

function FieldRow({ label, value, confidence, needsReview }: { label: string; value: any; confidence?: number; needsReview?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: '#111', border: `1px solid ${needsReview ? '#f59e0b' : '#1A1A1A'}`,
      borderRadius: '6px', padding: '0.875rem 1rem',
    }}>
      <div>
        <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
          {needsReview && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>⚠ Revisar</span>}
        </div>
        <div style={{ fontSize: '0.875rem', fontFamily: typeof value === 'number' ? 'var(--font-mono)' : undefined }}>
          {String(value ?? '—')}
        </div>
      </div>
      {confidence !== undefined && (
        <div style={{ fontSize: '0.7rem', color: confidence >= 0.7 ? '#22c55e' : '#f59e0b' }}>
          {(confidence * 100).toFixed(0)}%
        </div>
      )}
    </div>
  )
}

function LoadingCard({ message, hint }: { message: string; hint?: string }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1A1A1A', borderRadius: '12px',
      padding: '3rem', textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: hint ? '0.5rem' : 0 }}>{message}</div>
      {hint && <div style={{ fontSize: '0.75rem', color: '#555' }}>{hint}</div>}
    </div>
  )
}
