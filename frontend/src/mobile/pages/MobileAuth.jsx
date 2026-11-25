import { LoadingSkeleton } from "../../components/Skeletons"
import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { ArrowLeftIcon } from '../../components/icons/Lucide'

export function MobileAuth({ initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode)
  const [loginInput, setLoginInput] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        if (!loginInput.trim() || !password) {
          setError('Please enter your email/username and password.')
          setLoading(false)
          return
        }
        await login(loginInput.trim(), password)
      } else {
        if (!fullName.trim() || !email.trim() || !username.trim() || !password) {
          setError('Please fill out all registration fields.')
          setLoading(false)
          return
        }
        await register({
          fullName: fullName.trim(),
          email: email.trim(),
          username: username.trim(),
          password,
        })
      }
    } catch (err) {
      setError(err?.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      padding: 'max(16px, env(safe-area-inset-top, 0px)) max(20px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-left, 0px))',
      boxSizing: 'border-box',
    }}>
      {/* Top Bar with Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <button
          type="button"
          className="mobileTouchTarget"
          onClick={onBack}
          aria-label="Back to home"
          style={{ color: '#1E293B' }}
        >
          <ArrowLeftIcon size={24} />
        </button>
        <span style={{
          marginLeft: '8px',
          fontWeight: 700,
          fontSize: '1rem',
          fontFamily: 'var(--display, "Poppins", sans-serif)',
          color: '#122a58',
        }}>
          PolitikApp
        </span>
      </div>

      <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '400px', margin: '0 auto', width: '100%' }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 800,
          color: '#0F172A',
          margin: '0 0 6px',
          fontFamily: 'var(--display, "Poppins", sans-serif)',
        }}>
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p style={{
          fontSize: '0.875rem',
          color: '#64748B',
          margin: '0 0 24px',
        }}>
          {mode === 'login'
            ? 'Sign in to access your civic contributor workspace and reviews.'
            : 'Join verified civic contributors to preserve legislative provenance.'}
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            borderRadius: '10px',
            padding: '12px 14px',
            fontSize: '0.8125rem',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mode === 'register' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  required
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@example.ph"
                  required
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="juandelacruz"
                  required
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </>
          )}

          {mode === 'login' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Email or Username
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="juan@example.ph or username"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  padding: '0 14px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 14px',
                background: '#FFFFFF',
                color: '#0F172A',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mobileCardAction"
            style={{
              width: '100%',
              background: '#122a58',
              color: '#ffffff',
              marginTop: '10px',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <LoadingSkeleton inline label="Processing" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setError('')
              setMode(mode === 'login' ? 'register' : 'login')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#2563EB',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px',
              minHeight: '48px',
            }}
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MobileAuth

