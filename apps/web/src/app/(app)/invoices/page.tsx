'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { invoices as invoicesApi } from '@/lib/api'

const STATUS_FILTER = ['', 'DRAFT', 'FINALIZED', 'SENT', 'CANCELLED']
const STATUS_LABEL: Record<string, string> = {
  '': 'Todas', DRAFT: 'Borrador', FINALIZED: 'Emitida', SENT: 'Enviada', CANCELLED: 'Cancelada',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#555', FINALIZED: '#22c55e', SENT: '#3b82f6', CANCELLED: '#ef4444',
}

export default function InvoicesPage() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    invoicesApi.list({ status: status || undefined, page, limit: 20 })
      .then(res => { setItems(res.items); setTotal(res.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [status, page])

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700 }}>Facturas</h1>
        <Link
          href="/invoices/new"
          style={{
            background: '#FF4D00', color: '#fff', textDecoration: 'none',
            padding: '0.625rem 1.25rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 600,
          }}
        >
          + Nueva factura
        </Link>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {STATUS_FILTER.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: status === s ? '#FF4D00' : '#1A1A1A',
              background: status === s ? 'rgba(255,77,0,0.1)' : 'transparent',
              color: status === s ? '#FF4D00' : '#555',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: '0.875rem' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <EmptyInvoices />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {items.map(inv => <InvoiceRow key={inv.id} inv={inv} />)}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginBtn}>
                ← Anterior
              </button>
              <span style={{ padding: '0.5rem', color: '#555', fontSize: '0.875rem' }}>
                {page} / {Math.ceil(total / 20)}
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} style={paginBtn}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InvoiceRow({ inv }: { inv: any }) {
  return (
    <Link
      href={`/invoices/${inv.id}`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#111', border: '1px solid #1A1A1A', borderRadius: '6px',
        padding: '1rem', textDecoration: 'none', color: 'inherit',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {inv.numeroCompleto ?? '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.25rem' }}>
          {inv.receptorNombre ?? 'Cliente'} · {inv.fechaEmision ? new Date(inv.fechaEmision).toLocaleDateString('es-ES') : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em',
          color: STATUS_COLOR[inv.status] ?? '#555', textTransform: 'uppercase',
        }}>
          {inv.status}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-mono)', minWidth: '80px', textAlign: 'right' }}>
          {Number(inv.total ?? 0).toFixed(2)} €
        </span>
      </div>
    </Link>
  )
}

function EmptyInvoices() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#555', border: '1px dashed #1A1A1A', borderRadius: '8px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>◈</div>
      <div style={{ marginBottom: '1rem' }}>Aún no tienes facturas.</div>
      <Link href="/invoices/new" style={{ color: '#FF4D00', textDecoration: 'none', fontWeight: 500 }}>
        Crear tu primera factura →
      </Link>
    </div>
  )
}

const paginBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#111',
  border: '1px solid #1A1A1A',
  borderRadius: '6px',
  color: '#888',
  fontSize: '0.75rem',
  cursor: 'pointer',
}
