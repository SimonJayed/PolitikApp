import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'

const AuthContext = createContext(null)
function expiry(session) {
  try {
    const segment = session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(segment)).exp * 1000
  } catch { return 0 }
}
function storedSession() {
  try { return JSON.parse(localStorage.getItem('politikapp_auth') || 'null') }
  catch { return null }
}
async function authRequest(path, payload) {
  return fetch(`${API_BASE_URL}/auth/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(readApiResponse)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(storedSession)
  const [ready, setReady] = useState(() => { const saved = storedSession(); return !saved || expiry(saved) > Date.now() })
  const logout = useCallback(() => {
    localStorage.removeItem('politikapp_auth')
    setSession(null)
    setReady(true)
  }, [])
  const updateSession = useCallback(next => {
    setSession(previous => {
      if (!next) return null
      if (next.token && next.user) return next
      if (!previous) return null
      const user = { ...previous.user, ...next }
      return JSON.stringify(user) === JSON.stringify(previous.user) ? previous : { ...previous, user }
    })
  }, [])

  useEffect(() => {
    if (session) localStorage.setItem('politikapp_auth', JSON.stringify(session))
    else localStorage.removeItem('politikapp_auth')
  }, [session])

  useEffect(() => {
    if (!session) { setReady(true); return }
    let cancelled = false
    const delay = Math.max(0, expiry(session) - Date.now() - 120000)
    const timer = window.setTimeout(async () => {
      try {
        if (!session.refreshToken) throw new Error('Session expired.')
        const body = await authRequest('refresh', { refreshToken: session.refreshToken })
        if (!cancelled) setSession(previous => previous?.refreshToken === session.refreshToken ? { ...previous, ...body } : previous)
      } catch { if (!cancelled) setSession(null) }
      finally { if (!cancelled) setReady(true) }
    }, delay)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [session?.token, session?.refreshToken])

  useEffect(() => {
    const sync = event => { if (event.key === 'politikapp_auth') { const next = storedSession(); setSession(next); setReady(!next || expiry(next) > Date.now()) } }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const value = useMemo(() => ({
    token: session?.token || null,
    refreshToken: session?.refreshToken || null,
    user: session?.user || null,
    isAuthenticated: Boolean(session?.token && session?.user),
    async login(login, password) {
      const body = await authRequest('login', { login, password })
      setSession(body); setReady(true)
      return body
    },
    async register(payload) {
      const body = await authRequest('register', payload)
      setSession(body); setReady(true)
      return body
    },
    async refreshAuthToken() {
      const current = session?.refreshToken
      if (!current) throw new Error('No refresh token available.')
      try {
        const body = await authRequest('refresh', { refreshToken: current })
        setSession(previous => previous?.refreshToken === current ? { ...previous, ...body } : previous)
        return body
      } catch (error) {
        setSession(previous => previous?.refreshToken === current ? null : previous)
        throw error
      }
    },
    updateSession,
    logout,
  }), [session, updateSession, logout])
  return <AuthContext.Provider value={value}>{ready ? children : <p role="status">Restoring your session...</p>}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
