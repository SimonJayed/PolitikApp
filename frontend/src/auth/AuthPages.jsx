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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fieldErrorAliases = {
  fullName: 'fullName',
  name: 'fullName',
  email: 'email',
  login: 'email',
  password: 'password',
  confirmPassword: 'confirmPassword',
}

function validateRegistrationPassword(password) {
  if (!password) return 'Password is required.'
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 120) return 'Password must be 120 characters or fewer.'
  if (/\s/.test(password)) return 'Password cannot contain spaces.'
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (!/\d/.test(password)) return 'Password must include a number.'
  if (!/[^A-Za-z0-9\s]/.test(password)) return 'Password must include a special character.'
  return ''
}

function validateAuthField(field, values, isLogin) {
  const email = values.email.trim()
  const password = values.password

  if (!isLogin && field === 'fullName' && !values.fullName.trim()) {
    return 'Name is required.'
  }

  if (field === 'email') {
    if (!email) return 'Email is required.'
    if (!emailPattern.test(email)) return 'Enter a valid email address.'
  }

  if (field === 'password') {
    if (!password) return 'Password is required.'
    if (!isLogin) return validateRegistrationPassword(password)
  }

  if (!isLogin && field === 'confirmPassword') {
    if (!values.confirmPassword) return 'Confirm your password.'
    if (values.confirmPassword !== password) return 'Passwords do not match.'
  }

  return ''
}

function validateAuthForm(values, isLogin) {
  const fields = isLogin
    ? ['email', 'password']
    : ['fullName', 'email', 'password', 'confirmPassword']
  return fields.reduce((errors, field) => {
    const message = validateAuthField(field, values, isLogin)
    if (message) errors[field] = message
    return errors
  }, {})
}

function parseLegacyFieldErrors(message) {
  if (!message || !message.includes(':')) return {}
  return message.split(';').reduce((errors, part) => {
    const [rawField, ...rawMessage] = part.split(':')
    const field = fieldErrorAliases[rawField.trim()]
    const fieldMessage = rawMessage.join(':').trim()
    if (field && fieldMessage) errors[field] = fieldMessage
    return errors
  }, {})
}

function mapServerFieldErrors(error) {
  const combined = { ...parseLegacyFieldErrors(error?.message) }
  Object.entries(error?.fieldErrors || {}).forEach(([field, message]) => {
    const mappedField = fieldErrorAliases[field]
    if (mappedField && message) combined[mappedField] = message
  })
  return combined
}

function sanitizeServerMessage(message, fallback) {
  if (!message) return fallback
  if (/username/i.test(message)) return fallback
  if (message.includes(':')) return fallback
  return message
}

function AuthField({ autoComplete, error, icon, id, label, onChange, placeholder, required = true, type = 'text', value }) {
  return (
    <label className="authField" htmlFor={id}>
      <span className="authFieldLabel">{label}</span>
      <span className={`authFieldControl${error ? ' hasError' : ''}`}>
        <span className="authFieldIcon">{icon}</span>
        <input
          autoComplete={autoComplete}
          id={id}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </span>
      {error && <span className="authFieldError" id={`${id}-error`}>{error}</span>}
    </label>
  )
}

export default function AuthPages({ initialMode = 'login', onBack }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [state, setState] = useState({ loading: false, error: '', success: '' })
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const isLogin = mode === 'login'

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  function switchMode(nextMode) {
    setMode(nextMode)
    setState({ loading: false, error: '', success: '' })
    setFieldErrors({})
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function updateField(field, value) {
    setState((current) => ({ ...current, error: '', success: '' }))
    setForm((current) => {
      const nextForm = { ...current, [field]: value }
      setFieldErrors((currentErrors) => {
        const nextErrors = { ...currentErrors }
        const fieldMessage = validateAuthField(field, nextForm, isLogin)
        if (currentErrors[field] && fieldMessage) {
          nextErrors[field] = fieldMessage
        } else {
          delete nextErrors[field]
        }

        if (!isLogin && field === 'password' && (currentErrors.confirmPassword || nextForm.confirmPassword)) {
          const confirmMessage = validateAuthField('confirmPassword', nextForm, isLogin)
          if (confirmMessage) nextErrors.confirmPassword = confirmMessage
          else delete nextErrors.confirmPassword
        }

        return nextErrors
      })
      return nextForm
    })
  }

  function validateForm() {
    const errors = validateAuthForm(form, isLogin)
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!validateForm()) return
    setState({ loading: true, error: '', success: '' })
    try {
      if (isLogin) {
        await login(form.email.trim(), form.password)
      } else {
        await register({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: 'CONTRIBUTOR',
        })
        setState({ loading: false, error: '', success: 'Registration successful. Signing you in...' })
      }
    } catch (error) {
      const serverFieldErrors = mapServerFieldErrors(error)
      if (Object.keys(serverFieldErrors).length > 0) {
        setFieldErrors(serverFieldErrors)
      }
      setState({
        loading: false,
        error: Object.keys(serverFieldErrors).length > 0
          ? ''
          : sanitizeServerMessage(error.message, isLogin ? 'Sign in failed.' : 'Registration failed.'),
        success: '',
      })
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
                error={fieldErrors.fullName}
                icon={<UserIcon />}
                id="auth-fullname-input"
                label="Name"
                placeholder="e.g. Maria"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
              />
            )}

            <AuthField
              autoComplete="email"
              error={fieldErrors.email}
              icon={<MailIcon />}
              id="auth-login-input"
              label="Email Address"
              placeholder={isLogin ? 'email@domain.com' : 'citizen@domain.gov.ph'}
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />

            <label className="authField" htmlFor="auth-password-input">
              <span className="authFieldLabel">Password</span>
              <span className={`authFieldControl${fieldErrors.password ? ' hasError' : ''}`}>
                <span className="authFieldIcon"><KeyIcon size={20} /></span>
                <input
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  id="auth-password-input"
                  onChange={(e) => updateField('password', e.target.value)}
                  placeholder="Enter your password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'auth-password-input-error' : undefined}
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
              {fieldErrors.password && <span className="authFieldError" id="auth-password-input-error">{fieldErrors.password}</span>}
            </label>

            {!isLogin && (
              <label className="authField" htmlFor="auth-confirm-password-input">
                <span className="authFieldLabel">Confirm Password</span>
                <span className={`authFieldControl${fieldErrors.confirmPassword ? ' hasError' : ''}`}>
                  <span className="authFieldIcon"><KeyIcon size={20} /></span>
                  <input
                    autoComplete="new-password"
                  id="auth-confirm-password-input"
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder="Confirm your password"
                  required
                    type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
                  aria-describedby={fieldErrors.confirmPassword ? 'auth-confirm-password-input-error' : undefined}
                />
                <button
                  type="button"
                  className="authPasswordToggle"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  <EyeIcon hidden={showConfirmPassword} />
                </button>
              </span>
                {fieldErrors.confirmPassword && (
                  <span className="authFieldError" id="auth-confirm-password-input-error">{fieldErrors.confirmPassword}</span>
                )}
              </label>
            )}

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
