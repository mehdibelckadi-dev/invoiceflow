'use client'

import { useEffect, useState } from 'react'
import { billing, invoices, notifications } from '@/lib/api'

interface Stats {
  subscription: any
  usage: any
  recentInvoices: any[]
  unreadNotifs: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      billing.subscription(),
      billing.usage(),
      invoices.list({ limit: 5 }),
      notifications.unreadCount().catch(() => ({ count: 0 })),
    ]).then(([sub, usage, inv, notif]) => {
      setStats({ subscription: sub, usage, recentInvoices: inv.items, unreadNotifs: notif.count })
    }).catch(console.error)
  }, [])

  if (!stats) {
    return <div style={{ color: '#555', fontSize: '0.875rem' }}>Cargando...</div>
  }

  const { subscription: sub, usage, recentInvoices } = stats
  const planColor = sub.planSlug === 'free' ? '#555' : '#FF4D00'

  return (
    <div style={{ maxWidth: '960px' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
        Dashboard
      </h1>

      {/* Plan + usage cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Plan" value={sub.planName ?? 'FREE'} color={planColor} />
        <StatCard label="Facturas" value={`${usage.invoicesCount ?? 0} / ${sub.invoiceLimit === -1 ? '∞' : sub.invoiceLimit}`} />
        <StatCard label="OCR" value={`${usage.ocrCount ?? 0} / ${sub.ocrLimit === -1 ? '∞' : sub.ocrLimit}`} />
        <StatCard label="Asistente IA" value={`${usage.aiQueriesCount ?? 0} / ${sub.aiDailyLimit === -1 ? '∞' : sub.aiDailyLimit}`} />
      </div>

      {/* Recent invoices */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#888' }}>
          Facturas recientes
        </h2>
        {recentInvoices.length === 0 ? (
          <EmptyState message="No hay facturas todavía." action={{ label: 'Crear factura', href: '/invoices/new' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentInvoices.map((inv: any) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value, color = '#F5F0E8' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: '8px', padding: '1.25rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: any }) {
  const statusColor: Record<string, string> = {
    DRAFT: '#555',
    FINALIZED: '#22c55e',
    CANCELLED: '#ef4444',
    SENT: '#3b82f6',
  }
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#111',
      border: '1px solid #1A1A1A',
      borderRadius: '6px',
      padding: '0.875rem 1rem',
    }}>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {invoice.numeroCompleto ?? invoice.numero_completo ?? '—'}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.125rem' }}>
          {invoice.receptorNombre ?? invoice.receptor_nombre ?? 'Cliente'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.75rem', color: statusColor[invoice.status] ?? '#555' }}>
          {invoice.status}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {Number(invoice.total ?? 0).toFixed(2)} €
        </span>
      </div>
    </div>
  )
}

function EmptyState({ message, action }: { message: string; action?: { label: string; href: string } }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#555', border: '1px dashed #1A1A1A', borderRadius: '8px' }}>
      <div style={{ marginBottom: '1rem' }}>{message}</div>
      {action && (
        <a
          href={action.href}
          style={{ color: '#FF4D00', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}
        >
          {action.label} →
        </a>
      )}
    </div>
  )
}
