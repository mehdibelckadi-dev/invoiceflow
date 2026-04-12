'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface FiscalProfile {
  nif: string
  nombre: string
  domicilio: string
  cp: string
  poblacion: string
  provincia: string
  serie_defecto: string
  siguiente_num: number
  tipo_iva_defecto: number
  tipo_irpf_defecto: number
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<FiscalProfile | null>(null)
  const [form, setForm] = useState<Partial<FiscalProfile>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get<FiscalProfile>('/users/me/fiscal-profile')
      .then(p => { setProfile(p); setForm(p) })
      .catch(console.error)
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await api.put<FiscalProfile>('/users/me/fiscal-profile', form)
      setProfile(updated)
      setForm(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (key: keyof FiscalProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  if (!profile) return <div style={{ color: '#555', fontSize: '0.875rem' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '2rem' }}>
        Ajustes
      </h1>

      <form onSubmit={save}>
        <Section title="Datos fiscales">
          <Field label="NIF / NIE / CIF" value={form.nif ?? ''} onChange={f('nif')} required />
          <Field label="Nombre / Razón social" value={form.nombre ?? ''} onChange={f('nombre')} required />
          <Field label="Domicilio" value={form.domicilio ?? ''} onChange={f('domicilio')} />
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem' }}>
            <Field label="C.P." value={form.cp ?? ''} onChange={f('cp')} />
            <Field label="Población" value={form.poblacion ?? ''} onChange={f('poblacion')} />
          </div>
          <Field label="Provincia" value={form.provincia ?? ''} onChange={f('provincia')} />
        </Section>

        <Section title="Configuración de facturas">
          <Field label="Serie por defecto" value={form.serie_defecto ?? ''} onChange={f('serie_defecto')} />

          <div>
            <label style={labelStyle}>IVA por defecto</label>
            <select value={form.tipo_iva_defecto ?? 21} onChange={f('tipo_iva_defecto')} style={inputStyle}>
              {[0, 4, 10, 21].map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>IRPF por defecto</label>
            <select value={form.tipo_irpf_defecto ?? 15} onChange={f('tipo_irpf_defecto')} style={inputStyle}>
              {[0, 2, 7, 15].map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
        </Section>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '0.75rem 2rem',
            background: saved ? '#22c55e' : '#FF4D00',
            border: 'none', borderRadius: '6px',
            color: '#fff', fontSize: '0.875rem', fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.3s',
          }}
        >
          {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#555', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, required }: {
  label: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; required?: boolean
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={onChange} required={required} style={inputStyle} />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', color: '#555', marginBottom: '0.375rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.75rem',
  background: '#111', border: '1px solid #1A1A1A', borderRadius: '6px',
  color: '#F5F0E8', fontSize: '0.875rem', outline: 'none',
  boxSizing: 'border-box',
}
