'use client'

const BASE_URL = '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('lefse_token')
}

export function setToken(token: string) {
  localStorage.setItem('lefse_token', token)
}

export function clearToken() {
  localStorage.removeItem('lefse_token')
  localStorage.removeItem('lefse_refresh_token')
}

export function setRefreshToken(token: string) {
  localStorage.setItem('lefse_refresh_token', token)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('lefse_refresh_token')
}

class ApiClient {
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken()
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

    if (res.status === 401) {
      // Try refresh
      const refreshed = await this.tryRefresh()
      if (refreshed) {
        return this.request<T>(path, init)
      }
      clearToken()
      window.location.href = '/login'
      throw new Error('Unauthorized')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new ApiError(res.status, err.code ?? 'API_ERROR', err.message ?? 'Error desconocido')
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  private async tryRefresh(): Promise<boolean> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) return false
      const data = await res.json()
      setToken(data.token)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  get<T>(path: string) { return this.request<T>(path) }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
  }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }) }

  async postForm<T>(path: string, form: FormData): Promise<T> {
    const token = getToken()
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }))
      throw new ApiError(res.status, err.code ?? 'API_ERROR', err.message ?? 'Error')
    }
    return res.json() as Promise<T>
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const api = new ApiClient()

// ── Auth ──────────────────────────────────────────────────

export const auth = {
  login: (email: string, password: string) =>
    api.post<{ token: string; refreshToken: string; user: any }>('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<{ id: string; email: string; displayName: string }>('/users/me'),
}

// ── Invoices ──────────────────────────────────────────────

export const invoices = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<{ items: any[]; total: number }>(`/invoices?${new URLSearchParams(params as any)}`),

  get: (id: string) => api.get<any>(`/invoices/${id}`),

  create: (data: any) => api.post<any>('/invoices', data),

  update: (id: string, data: any) => api.patch<any>(`/invoices/${id}`, data),

  finalize: (id: string) => api.post<any>(`/invoices/${id}/finalize`),

  cancel: (id: string) => api.post<any>(`/invoices/${id}/cancel`),
}

// ── OCR ───────────────────────────────────────────────────

export const ocr = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.postForm<{ jobId: string; status: string }>('/ocr/upload', form)
  },

  result: (jobId: string) => api.get<any>(`/ocr/result/${jobId}`),
}

// ── Inbox ─────────────────────────────────────────────────

export const inbox = {
  list: (params?: { status?: string; page?: number }) =>
    api.get<{ items: any[]; total: number }>(`/inbox?${new URLSearchParams(params as any)}`),

  approve: (id: string) => api.post<any>(`/inbox/${id}/approve`),

  reject: (id: string) => api.post<any>(`/inbox/${id}/reject`),
}

// ── Notifications ─────────────────────────────────────────

export const notifications = {
  list: (unreadOnly?: boolean) =>
    api.get<{ items: any[]; total: number }>(`/notifications?unreadOnly=${unreadOnly ?? false}`),

  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => api.patch<any>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<any>('/notifications/read-all'),
}

// ── Billing ───────────────────────────────────────────────

export const billing = {
  plans: () => api.get<any[]>('/billing/plans'),

  subscription: () => api.get<any>('/billing/subscription'),

  usage: () => api.get<any>('/billing/usage'),

  checkout: (priceId: string, period: 'monthly' | 'annual') =>
    api.post<{ url: string }>('/billing/checkout', { priceId, period }),

  portal: () => api.post<{ url: string }>('/billing/portal'),
}

// ── AI ────────────────────────────────────────────────────

export const aiApi = {
  conversations: () => api.get<any[]>('/ai/conversations'),

  messages: (id: string) => api.get<any[]>(`/ai/conversations/${id}`),

  deleteConversation: (id: string) => api.delete<any>(`/ai/conversations/${id}`),

  // Returns EventSource-compatible URL (caller sets token header manually)
  chatStream: async function* (message: string, conversationId?: string): AsyncGenerator<string> {
    const token = getToken()
    const res = await fetch(`/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, conversationId }),
    })

    if (!res.ok) throw new ApiError(res.status, 'AI_ERROR', 'Error en el asistente')

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.delta) yield parsed.delta
        } catch { /* skip */ }
      }
    }
  },
}
