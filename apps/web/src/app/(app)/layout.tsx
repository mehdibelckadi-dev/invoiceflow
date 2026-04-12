'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',   icon: '⊞' },
  { href: '/invoices',   label: 'Facturas',     icon: '◈' },
  { href: '/inbox',      label: 'Bandeja',      icon: '✉' },
  { href: '/ocr',        label: 'OCR',          icon: '⊙' },
  { href: '/ai',         label: 'Asistente',    icon: '✦' },
  { href: '/billing',    label: 'Plan',         icon: '◎' },
  { href: '/settings',   label: 'Ajustes',      icon: '⊛' },
]

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0A' }}>
        <div style={{ color: '#FF4D00', fontSize: '1.5rem', fontFamily: 'var(--font-syne)' }}>Lefse</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0A0A0A', color: '#F5F0E8' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        borderRight: '1px solid #1A1A1A',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0',
        flexShrink: 0,
      }}>
        <div style={{ padding: '0 1.5rem 2rem', fontSize: '1.25rem', fontFamily: 'var(--font-syne)', fontWeight: 700, color: '#FF4D00' }}>
          Lefse
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.75rem' }}>
          {NAV.map(item => {
            const active = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  color: active ? '#FF4D00' : '#888',
                  background: active ? 'rgba(255,77,0,0.08)' : 'transparent',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1rem', opacity: 0.8 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #1A1A1A' }}>
          <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.email}
          </div>
          <button
            onClick={logout}
            style={{ fontSize: '0.75rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        {children}
      </main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
