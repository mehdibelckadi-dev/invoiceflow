'use client'

import { useEffect, useState } from 'react'
import { billing as billingApi } from '@/lib/api'

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>([])
  const [subscription, setSubscription] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    Promise.all([billingApi.plans(), billingApi.subscription(), billingApi.usage()])
      .then(([p, s, u]) => { setPlans(p); setSubscription(s); setUsage(u) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function checkout(priceId: string) {
    try {
      const { url } = await billingApi.checkout(priceId, period)
      window.location.href = url
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function openPortal() {
    try {
      const { url } = await billingApi.portal()
      window.location.href = url
    } catch (e: any) {
      alert(e.message)
    }
  }

  if (loading) return <div style={{ color: '#555', fontSize: '0.875rem' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '960px' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Plan y facturación
      </h1>

      {/* Current plan */}
      {subscription && (
        <div style={{
          background: '#111', border: '1px solid #1A1A1A', borderRadius: '8px',
          padding: '1.25rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.25rem' }}>Plan actual</div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#FF4D00' }}>
              {subscription.planName ?? 'Lefse FREE'}
            </div>
            {subscription.currentPeriodEnd && (
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '0.25rem' }}>
                Próxima renovación: {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </div>
            )}
          </div>
          {subscription.planSlug !== 'free' && (
            <button onClick={openPortal} style={outlineBtn}>
              Gestionar suscripción
            </button>
          )}
        </div>
      )}

      {/* Period toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        {(['monthly', 'annual'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: '0.375rem 1rem', borderRadius: '20px', border: '1px solid',
              borderColor: period === p ? '#FF4D00' : '#1A1A1A',
              background: period === p ? 'rgba(255,77,0,0.1)' : 'transparent',
              color: period === p ? '#FF4D00' : '#555',
              fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            {p === 'monthly' ? 'Mensual' : 'Anual (-20%)'}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {plans.map(plan => {
          const price = period === 'monthly' ? plan.priceMonthlyEur : (plan.priceAnnualEur / 12)
          const priceId = period === 'monthly' ? plan.stripePriceMonthlyId : plan.stripePriceAnnualId
          const isCurrent = subscription?.planSlug === plan.slug
          const isPro = plan.slug === 'pro'

          return (
            <div
              key={plan.slug}
              style={{
                background: '#111',
                border: `1px solid ${isPro ? '#FF4D00' : '#1A1A1A'}`,
                borderRadius: '10px',
                padding: '1.5rem',
                position: 'relative',
              }}
            >
              {isPro && (
                <div style={{
                  position: 'absolute', top: '-1px', right: '1rem',
                  background: '#FF4D00', color: '#fff', fontSize: '0.65rem', fontWeight: 700,
                  padding: '0.2rem 0.5rem', borderRadius: '0 0 4px 4px', letterSpacing: '0.05em',
                }}>
                  POPULAR
                </div>
              )}

              <div style={{ fontFamily: 'var(--font-syne)', fontWeight: 700, marginBottom: '0.5rem' }}>
                {plan.name}
              </div>

              <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', fontFamily: 'var(--font-mono)' }}>
                {price === 0 ? 'Gratis' : `${Number(price).toFixed(2)}€`}
                {price > 0 && <span style={{ fontSize: '0.75rem', color: '#555', fontFamily: 'var(--font-inter)' }}>/mes</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.5rem' }}>
                <Feature label={`${plan.invoiceLimit === -1 ? '∞' : plan.invoiceLimit} facturas/mes`} />
                <Feature label={`${plan.ocrLimit === -1 ? '∞' : plan.ocrLimit} OCR/mes`} />
                <Feature label={`${plan.aiDailyLimit === -1 ? '∞' : plan.aiDailyLimit} consultas IA/día`} />
                <Feature label={`${plan.emailLimit === -1 ? '∞' : plan.emailLimit} emails/mes`} />
              </div>

              {isCurrent ? (
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>
                  ✓ Plan actual
                </div>
              ) : plan.slug === 'free' ? null : (
                <button
                  onClick={() => priceId && checkout(priceId)}
                  disabled={!priceId}
                  style={{
                    width: '100%', padding: '0.625rem',
                    background: isPro ? '#FF4D00' : 'transparent',
                    border: `1px solid ${isPro ? '#FF4D00' : '#333'}`,
                    borderRadius: '6px', color: isPro ? '#fff' : '#888',
                    fontSize: '0.8rem', fontWeight: 600, cursor: priceId ? 'pointer' : 'not-allowed',
                  }}
                >
                  {subscription?.planSlug === 'free' ? 'Empezar prueba' : 'Cambiar plan'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Feature({ label }: { label: string }) {
  return (
    <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <span style={{ color: '#22c55e' }}>✓</span>
      {label}
    </div>
  )
}

const outlineBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: '6px',
  color: '#888',
  fontSize: '0.75rem',
  cursor: 'pointer',
}
