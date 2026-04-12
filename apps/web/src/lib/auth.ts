'use client'

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { auth as authApi, setToken, setRefreshToken, clearToken } from './api'

interface User {
  id: string
  email: string
  displayName: string
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('lefse_token')
    if (!token) { setLoading(false); return }

    authApi.me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await authApi.login(email, password)
    setToken(data.token)
    setRefreshToken(data.refreshToken)
    setUser(data.user)
  }

  async function logout() {
    try { await authApi.logout() } catch { /* ignore */ }
    clearToken()
    setUser(null)
    window.location.href = '/login'
  }

  return React.createElement(AuthContext.Provider, { value: { user, loading, login, logout } }, children)
}

export function useAuth() {
  return useContext(AuthContext)
}
