import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import './AuthPages.css'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CircleCheckIcon,
  KeyIcon,
} from '../components/icons/Lucide'

function MailIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function UserIcon({ size = 20 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M5 21a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon({ hidden = false, size = 20 }) {
  if (hidden) {
    return (
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8.5 5.5A9.8 9.8 0 0 1 12 5c6 0 9 7 9 7a16.2 16.2 0 0 1-2.2 3.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.3 6.9C4.1 8.4 3 12 3 12s3 7 9 7a9.7 9.7 0 0 0 4-.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function AuthField({ autoComplete, icon, id, label, onChange, placeholder, required = true, type = 'text', value }) {
  return (
    <label className="authField" htmlFor={id}>
      <span className="authFieldLabel">{label}</span>
      <span className="authFieldControl">
        <span className="authFieldIcon">{icon}</span>
        <input
          autoComplete={autoComplete}
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
        />
      </span>
    </label>
  )
}

export default function AuthPages({ initialMode = 'login', onBack }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [state, setState] = useState({ loading: false, error: '', success: '' })
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const isLogin = mode === 'login'

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  function switchMode(nextMode) {
    setMode(nextMode)
    setState({ loading: false, error: '', success: '' })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setState({ loading: true, error: '', success: '' })
    try {
      if (isLogin) {
        await login(form.email, form.password)
      } else {
        await register({ ...form, username: form.email, role: 'CONTRIBUTOR' })
        setState({ loading: false, error: '', success: 'Registration successful. Signing you in...' })
      }
    } catch (error) {
      setState({ loading: false, error: error.message || 'Authentication failed.', success: '' })
      return
    }
    setState((current) => ({ ...current, loading: false }))
  }

  return (
    <main className="authModernShell">
      <section className="authModernPanel authModernVisual" aria-label="PolitikApp sign in overview">
        <div className="authShape authShapeOne" />
        <div className="authShape authShapeTwo" />
        <div className="authShape authShapeThree" />

        <div className="authBrandBlock">
          <p className="authBrandKicker">PolitikApp</p>
          <h1>Evidence-first civic accountability.</h1>
          <p>
            Track public servants through source-backed records, audit trails, and governance indicators.
          </p>
        </div>

      </section>

      <section className="authModernPanel authFormSection">
        <div className="authFormWrapper">
          {onBack && (
            <button className="authBackLink" id="auth-back-to-home-btn" type="button" onClick={onBack}>
              <ArrowLeftIcon size={18} />
              <span>Back to Home</span>
            </button>
          )}

          <div className="authFormHeader">
            <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
            <p>
              {isLogin
                ? 'Enter your credentials to continue reviewing public governance records.'
                : 'Create a citizen contributor account to submit and track evidence-backed records.'}
            </p>
          </div>

          <div className={`authModeTabs ${isLogin ? 'is-login' : 'is-register'}`} role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              id="auth-tab-login"
              className={isLogin ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              id="auth-tab-register"
              className={!isLogin ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              Create Account
            </button>
          </div>

          <form className="authModernForm" onSubmit={handleSubmit}>
            {!isLogin && (
              <AuthField
                autoComplete="name"
                icon={<UserIcon />}
                id="auth-fullname-input"
                label="Full Name"
                placeholder="e.g. Maria Santos"
                value={form.fullName}
                onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
              />
            )}

            <AuthField
              autoComplete={isLogin ? 'username' : 'email'}
              icon={<MailIcon />}
              id="auth-login-input"
              label={isLogin ? 'Email or Username' : 'Email Address'}
              placeholder={isLogin ? 'username or email@domain.com' : 'citizen@domain.gov.ph'}
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
            />

            <label className="authField" htmlFor="auth-password-input">
              <span className="authFieldLabel">Password</span>
              <span className="authFieldControl">
                <span className="authFieldIcon"><KeyIcon size={20} /></span>
                <input
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  id="auth-password-input"
                  onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                />
                <button
                  type="button"
                  className="authPasswordToggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </span>
            </label>

            {state.error && (
              <div className="authAlert error">
                <AlertTriangleIcon size={16} />
                <span>{state.error}</span>
              </div>
            )}

            {state.success && (
              <div className="authAlert success">
                <CircleCheckIcon size={16} />
                <span>{state.success}</span>
              </div>
            )}

            <button id="auth-submit-btn" className="authSubmitButton" type="submit" disabled={state.loading}>
              {state.loading ? 'Verifying...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>

            <p className="authFormFooter">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button type="button" onClick={() => switchMode(isLogin ? 'register' : 'login')}>
                {isLogin ? 'Create one' : 'Sign in'}
              </button>
            </p>
          </form>
        </div>
      </section>
    </main>
  )
}
