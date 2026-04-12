'use client'

import { useEffect, useRef, useState } from 'react'
import { aiApi } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [convId] = useState(() => crypto.randomUUID())
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setStreaming(true)

    // Add empty assistant message to stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      for await (const delta of aiApi.chatStream(userMsg, convId)) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + delta,
          }
          return updated
        })
      }
    } catch (e: any) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${e.message}` }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px', height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Asistente fiscal ✦
        </h1>
        <p style={{ color: '#555', fontSize: '0.875rem' }}>
          Pregúntame sobre IVA, IRPF, Verifactu, modelos 303/130, y más.
        </p>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
        {messages.length === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                style={{
                  textAlign: 'left', padding: '0.875rem 1rem',
                  background: '#111', border: '1px solid #1A1A1A', borderRadius: '8px',
                  color: '#888', fontSize: '0.8rem', cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '80%',
              padding: '0.875rem 1rem',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? '#FF4D00' : '#111',
              border: msg.role === 'user' ? 'none' : '1px solid #1A1A1A',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              color: msg.role === 'user' ? '#fff' : '#F5F0E8',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content || (streaming && i === messages.length - 1 ? '▌' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Pregunta algo sobre tu fiscalidad..."
          disabled={streaming}
          style={{
            flex: 1, padding: '0.875rem 1rem',
            background: '#111', border: '1px solid #1A1A1A', borderRadius: '8px',
            color: '#F5F0E8', fontSize: '0.875rem', outline: 'none',
            opacity: streaming ? 0.6 : 1,
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          style={{
            padding: '0.875rem 1.5rem',
            background: input.trim() && !streaming ? '#FF4D00' : '#1A1A1A',
            border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '0.875rem', fontWeight: 600,
            cursor: input.trim() && !streaming ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {streaming ? '...' : '→'}
        </button>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  '¿Qué porcentaje de IVA aplica a mis servicios?',
  '¿Cuándo tengo que presentar el Modelo 303?',
  '¿Qué es Verifactu y me afecta?',
  '¿Puedo deducir mis gastos de oficina en casa?',
]
