import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export default function AuthPages({ initialMode = 'login', onBack }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [state, setState] = useState({ loading: false, error: '', success: '' })
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '' })

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  async function handleSubmit(event) {
    event.preventDefault()
    setState({ loading: true, error: '', success: '' })
    try {
      if (mode === 'login') {
        await login(form.email || form.username, form.password)
      } else {
        await register({ ...form, role: 'CONTRIBUTOR' })
        setState({ loading: false, error: '', success: 'Registration successful. Signing you in...' })
      }
    } catch (error) {
      setState({ loading: false, error: error.message || 'Authentication failed.', success: '' })
      return
    }
    setState((current) => ({ ...current, loading: false }))
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(13, 148, 136, 0.08) 0%, #f1f5f9 60%, #e2e8f0 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        color: '#0f172a',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0a1d42 0%, #122a58 100%)',
              color: '#ffffff',
              fontSize: '28px',
              marginBottom: '12px',
              boxShadow: '0 8px 20px rgba(10, 29, 66, 0.25)',
            }}
          >
            🏛️
          </div>
          <h1
            style={{
              fontFamily: "var(--display, 'Poppins', sans-serif)",
              fontSize: '26px',
              fontWeight: '800',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
              color: '#0f172a',
            }}
          >
            PolitikApp
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Primary-Source Governance &amp; Public Official Auditing
          </p>
        </div>

        {/* Main Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 35px rgba(15, 23, 42, 0.08)',
            padding: '32px 28px',
          }}
        >
          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '24px',
            }}
          >
            <button
              type="button"
              id="auth-tab-login"
              onClick={() => {
                setMode('login')
                setState({ loading: false, error: '', success: '' })
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'login' ? '#ffffff' : 'transparent',
                color: mode === 'login' ? '#0f172a' : '#64748b',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              id="auth-tab-register"
              onClick={() => {
                setMode('register')
                setState({ loading: false, error: '', success: '' })
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: mode === 'register' ? '#ffffff' : 'transparent',
                color: mode === 'register' ? '#0f172a' : '#64748b',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: mode === 'register' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                  Full Name
                </label>
                <input
                  id="auth-fullname-input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Maria Santos"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                {mode === 'login' ? 'Email or Username' : 'Email Address'}
              </label>
              <input
                id="auth-login-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder={mode === 'login' ? 'username or email@domain.com' : 'citizen@domain.gov.ph'}
                required
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                  Choose Username
                </label>
                <input
                  id="auth-username-input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. maria_santos"
                  required
                  value={form.username}
                  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '5px' }}>
                Password
              </label>
              <input
                id="auth-password-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                placeholder="••••••••"
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              />
            </div>

            {state.error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{state.error}</span>
              </div>
            )}

            {state.success && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>✓</span>
                <span>{state.success}</span>
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={state.loading}
              style={{
                marginTop: '6px',
                padding: '12px 20px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                border: 'none',
                cursor: state.loading ? 'not-allowed' : 'pointer',
                opacity: state.loading ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              {state.loading
                ? 'Verifying...'
                : mode === 'login'
                ? 'Sign In to Console'
                : 'Create Citizen Account'}
            </button>
          </form>
        </div>

        {/* Escape / Back Link */}
        {onBack && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              id="auth-back-to-politicians-btn"
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#0f766e',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              <span>← Back to Public Politicians</span>
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
