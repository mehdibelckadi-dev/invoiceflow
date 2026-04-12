import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { db } from '../../db.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'

// ── Encryption (AES-256-GCM) for conversation messages ───

const ENC_KEY = createHash('sha256').update(env.JWT_SECRET).digest()  // 32 bytes

function encrypt(text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decrypt(data: string): string {
  const buf = Buffer.from(data, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', ENC_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}

// ── Mistral EU embeddings ─────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(`${env.MISTRAL_API_URL}/v1/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'mistral-embed', input: [text] }),
  })
  if (!res.ok) throw new AppError('AI_EMBED_ERROR', 'Embedding failed', 502)
  const data = await res.json() as any
  return data.data[0].embedding
}

// ── RAG: buscar contexto en vector_embeddings ─────────────

async function retrieveContext(userId: string, queryEmbedding: number[]): Promise<string> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`

  const rows = await db`
    SELECT content, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
    FROM vector_embeddings
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${vectorLiteral}::vector
    LIMIT 5
  `

  if (!rows.length) return ''
  return rows
    .filter((r: any) => r.similarity > 0.7)
    .map((r: any) => r.content)
    .join('\n\n')
}

// ── Ensure conversation exists ────────────────────────────

async function ensureConversation(userId: string, conversationId: string, firstMessage: string): Promise<void> {
  await db`
    INSERT INTO ai_conversations (id, user_id, title)
    VALUES (${conversationId}, ${userId}, ${firstMessage.slice(0, 100)})
    ON CONFLICT (id) DO NOTHING
  `
}

// ── Get history (last 20, decrypted) ─────────────────────

async function getHistory(conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const rows = await db`
    SELECT role, content_encrypted
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at DESC
    LIMIT 20
  `
  return rows
    .reverse()
    .map((r: any) => ({ role: r.role, content: decrypt(r.contentEncrypted) }))
}

// ── Save message ──────────────────────────────────────────

async function saveMessage(
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  tokensUsed?: number,
) {
  await db`
    INSERT INTO ai_messages (conversation_id, user_id, role, content_encrypted, tokens_used)
    VALUES (${conversationId}, ${userId}, ${role}, ${encrypt(content)}, ${tokensUsed ?? null})
  `
  await db`
    UPDATE ai_conversations SET updated_at = NOW() WHERE id = ${conversationId}
  `
}

// ── Main chat (async generator → SSE) ────────────────────

export async function* chatStream(
  userId: string,
  conversationId: string,
  userMessage: string,
): AsyncGenerator<string> {
  // Ensure conversation row exists
  await ensureConversation(userId, conversationId, userMessage)

  // Save user message
  await saveMessage(userId, conversationId, 'user', userMessage)

  // RAG: embed + retrieve
  let context = ''
  try {
    const embedding = await embedQuery(userMessage)
    context = await retrieveContext(userId, embedding)
  } catch {
    // RAG failure is non-fatal — continue without context
  }

  // Build messages array
  const history = await getHistory(conversationId)
  const messages = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...history.slice(-10),  // last 10 messages
    { role: 'user', content: userMessage },
  ]

  // Mistral streaming completion
  const res = await fetch(`${env.MISTRAL_API_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) throw new AppError('AI_CHAT_ERROR', `Mistral error: ${res.status}`, 502)

  let fullResponse = ''
  let tokensUsed = 0
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') break

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content ?? ''
        if (delta) {
          fullResponse += delta
          yield `data: ${JSON.stringify({ delta })}\n\n`
        }
        if (parsed.usage?.total_tokens) tokensUsed = parsed.usage.total_tokens
      } catch {
        // skip malformed chunks
      }
    }
  }

  // Persist assistant response
  if (fullResponse) {
    await saveMessage(userId, conversationId, 'assistant', fullResponse, tokensUsed)
  }

  yield `data: [DONE]\n\n`
}

function buildSystemPrompt(context: string): string {
  const base = `Eres el asistente fiscal de Lefse, especializado en fiscalidad española para autónomos.
Conoces en profundidad: IRPF, IVA, Verifactu (RD 1007/2023), modelo 303, modelo 130, facturación electrónica.
Responde siempre en español, de forma concisa y práctica.
Si no sabes algo con certeza, indícalo claramente.
No des consejo legal personalizado — recomienda consultar a un asesor para casos complejos.`

  if (!context) return base
  return `${base}\n\nCONTEXTO DEL USUARIO:\n${context}`
}

// ── Conversation CRUD ─────────────────────────────────────

export async function listConversations(userId: string) {
  return db`
    SELECT id, title, created_at, updated_at
    FROM ai_conversations
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 50
  `
}

export async function getConversationMessages(userId: string, conversationId: string) {
  const [conv] = await db`
    SELECT id FROM ai_conversations WHERE id = ${conversationId} AND user_id = ${userId}
  `
  if (!conv) throw new AppError('CONV_NOT_FOUND', 'Conversación no encontrada', 404)

  const rows = await db`
    SELECT role, content_encrypted, created_at
    FROM ai_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `
  return rows.map((r: any) => ({
    role: r.role,
    content: decrypt(r.contentEncrypted),
    createdAt: r.createdAt,
  }))
}

export async function deleteConversation(userId: string, conversationId: string) {
  const [conv] = await db`
    SELECT id FROM ai_conversations WHERE id = ${conversationId} AND user_id = ${userId}
  `
  if (!conv) throw new AppError('CONV_NOT_FOUND', 'Conversación no encontrada', 404)

  // ON DELETE CASCADE eliminates ai_messages automatically
  await db`DELETE FROM ai_conversations WHERE id = ${conversationId}`
  return { deleted: true }
}
