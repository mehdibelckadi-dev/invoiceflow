'use client'

import { useEffect, useState } from 'react'
import { inbox as inboxApi } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  PROCESSING: '#3b82f6',
  PENDING_REVIEW: '#f59e0b',
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  ERROR: '#ef4444',
}

export default function InboxPage() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const load = () => {
    setLoading(true)
    inboxApi.list({ status: statusFilter || undefined })
      .then(res => { setItems(res.items); setTotal(res.total) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter])

  async function approve(id: string) {
    await inboxApi.approve(id)
    load()
  }

  async function reject(id: string) {
    await inboxApi.reject(id)
    load()
  }

  return (
    <div style={{ maxWidth: '960px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Bandeja de entrada
        </h1>
        <p style={{ color: '#555', fontSize: '0.875rem' }}>
          Facturas recibidas por email a tu dirección <span style={{ color: '#888', fontFamily: 'var(--font-mono)' }}>@inbox.lefse.io</span>
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.375rem 0.875rem', borderRadius: '20px', border: '1px solid',
              borderColor: statusFilter === s ? '#FF4D00' : '#1A1A1A',
              background: statusFilter === s ? 'rgba(255,77,0,0.1)' : 'transparent',
              color: statusFilter === s ? '#FF4D00' : '#555',
              fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            {s === '' ? 'Todos' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#555', fontSize: '0.875rem' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <EmptyInbox />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: '#111', border: '1px solid #1A1A1A', borderRadius: '6px',
                padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.subject ?? '(sin asunto)'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.25rem' }}>
                  {item.fromName ? `${item.fromName} <${item.fromEmail}>` : item.fromEmail}
                  {' · '}
                  {new Date(item.receivedAt).toLocaleDateString('es-ES')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1rem' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: STATUS_COLORS[item.status] ?? '#555',
                }}>
                  {item.status.replace('_', ' ')}
                </span>

                {item.status === 'PENDING_REVIEW' && (
                  <>
                    <button onClick={() => approve(item.id)} style={actionBtn('#22c55e')}>Aprobar</button>
                    <button onClick={() => reject(item.id)} style={actionBtn('#ef4444')}>Rechazar</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: '0.375rem 0.75rem', borderRadius: '4px',
    border: `1px solid ${color}22`, background: `${color}11`,
    color, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500,
  }
}

function EmptyInbox() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: '#555', border: '1px dashed #1A1A1A', borderRadius: '8px' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✉</div>
      <div>No hay emails en tu bandeja.</div>
      <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#333' }}>
        Reenvía facturas a tu dirección @inbox.lefse.io para procesarlas automáticamente.
      </div>
    </div>
  )
}
