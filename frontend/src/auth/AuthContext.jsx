import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const AuthContext = createContext(null)

function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem('politikapp_auth') || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession())

  useEffect(() => {
    if (session) {
      localStorage.setItem('politikapp_auth', JSON.stringify(session))
    } else {
      localStorage.removeItem('politikapp_auth')
    }
  }, [session])

  useEffect(() => {
    if (!session?.refreshToken || !session?.expiresInSeconds) return undefined
    const refreshInMs = Math.max((Number(session.expiresInSeconds) - 120) * 1000, 30_000)
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          setSession(null)
          return
        }
        setSession((prev) => ({ ...(prev || {}), ...body, user: body.user || prev?.user || null }))
      } catch {
        setSession(null)
      }
    }, refreshInMs)
    return () => window.clearTimeout(timer)
  }, [session?.expiresInSeconds, session?.refreshToken])

  const value = useMemo(() => ({
    token: session?.token || null,
    refreshToken: session?.refreshToken || null,
    user: session?.user || null,
    isAuthenticated: Boolean(session?.token && session?.user),
    async login(login, password) {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Login failed.')
      setSession(body)
      return body
    },
    async refreshAuthToken() {
      const currentRefreshToken = session?.refreshToken
      if (!currentRefreshToken) throw new Error('No refresh token available.')
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSession(null)
        throw new Error(body.message || 'Session refresh failed.')
      }
      setSession((prev) => ({
        ...(prev || {}),
        ...body,
        user: body.user || prev?.user || null,
      }))
      return body
    },
    async register(payload) {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Registration failed.')
      setSession(body)
      return body
    },
    updateSession(newSession) {
      setSession((prev) => {
        if (!newSession) return null;
        if (newSession.token && newSession.user) {
          return newSession;
        }
        if (prev) {
          return { ...prev, user: { ...prev.user, ...newSession } };
        }
        return prev;
      });
    },
    logout() {
      setSession(null)
    },
  }), [session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
