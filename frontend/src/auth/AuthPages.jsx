import { useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import './AuthPages.css'
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CircleCheckIcon,
  LockIcon,
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
  return hidden ? (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 5.5A9.8 9.8 0 0 1 12 5c6 0 9 7 9 7a16.2 16.2 0 0 1-2.2 3.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.3 6.9C4.1 8.4 3 12 3 12s3 7 9 7a9.7 9.7 0 0 0 4-.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[A-Za-z0-9_.-]+$/
const fieldErrorAliases = {
  fullName: 'fullName',
  name: 'fullName',
  email: 'email',
  login: 'email',
  username: 'username',
  password: 'password',
  confirmPassword: 'confirmPassword',
}

const passwordRequirementDefinitions = [
  { id: 'length', label: 'At least 8 characters', test: (password) => password.length >= 8 },
  { id: 'uppercase', label: 'At least one uppercase letter (A-Z)', test: (password) => /[A-Z]/.test(password) },
  { id: 'lowercase', label: 'At least one lowercase letter (a-z)', test: (password) => /[a-z]/.test(password) },
  { id: 'number', label: 'At least one number (0-9)', test: (password) => /\d/.test(password) },
  { id: 'special', label: 'At least one special character (e.g. !, @, #, $, %, &)', test: (password) => /[^A-Za-z0-9\s]/.test(password) },
]

function getPasswordRequirements(password) {
  return passwordRequirementDefinitions.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }))
}

function hasValidRegistrationPassword(password) {
  return getPasswordRequirements(password).every((requirement) => requirement.met)
}

function validateAuthField(field, values, isLogin) {
  const value = values[field]?.trim() || ''
  if (!isLogin && field === 'fullName' && !value) return 'Name is required.'
  if (!isLogin && field === 'username') {
    if (!value) return 'Username is required.'
    if (value.length < 3 || value.length > 80) return 'Username must be between 3 and 80 characters.'
    if (!usernamePattern.test(value)) return 'Username may only contain letters, numbers, dots, underscores, and hyphens.'
  }
  if (field === 'email' && !isLogin) {
    if (!value) return 'Email is required.'
    if (!emailPattern.test(value)) return 'Enter a valid email address.'
  }
  if (field === 'email' && isLogin && !value) return 'Email or username is required.'
  if (field === 'password') {
    if (!values.password) return 'Password is required.'
    if (!isLogin) {
      if (values.password.length > 120) return 'Password must be 120 characters or fewer.'
      if (!hasValidRegistrationPassword(values.password)) return 'Review the password requirements below.'
    }
  }
  if (!isLogin && field === 'confirmPassword') {
    if (!values.confirmPassword) return 'Confirm your password.'
    if (values.confirmPassword !== values.password) return 'Passwords do not match.'
  }
  return ''
}

function validateAuthForm(values, isLogin) {
  const fields = isLogin
    ? ['email', 'password']
    : ['fullName', 'email', 'username', 'password', 'confirmPassword']
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
  if (!message || message.includes(':')) return fallback
  return message
}

function AuthField({ autoComplete, error, icon, id, label, onChange, placeholder, type = 'text', value }) {
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
          required
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

function RequirementItem({ met, children }) {
  return (
    <li className={`authRequirementItem${met ? ' isMet' : ''}`}>
      <span className="authRequirementIndicator" aria-hidden="true">
        {met && <CircleCheckIcon size={13} />}
      </span>
      <span>{children}</span>
      <span className="srOnly">{met ? ' completed' : ' not completed'}</span>
    </li>
  )
}

export default function AuthPages({ initialMode = 'login', onBack }) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [state, setState] = useState({ loading: false, error: '' })
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', confirmPassword: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const isLogin = mode === 'login'
  const passwordRequirements = getPasswordRequirements(form.password)
  const passwordsMatch = Boolean(form.password && form.confirmPassword && form.password === form.confirmPassword)

  useEffect(() => setMode(initialMode), [initialMode])

  function switchMode(nextMode) {
    setMode(nextMode)
    setState({ loading: false, error: '' })
    setFieldErrors({})
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function updateField(field, value) {
    setState((current) => ({ ...current, error: '' }))
    setForm((current) => {
      const nextForm = { ...current, [field]: value }
      setFieldErrors((currentErrors) => {
        const nextErrors = { ...currentErrors }
        const fieldMessage = validateAuthField(field, nextForm, isLogin)
        if (currentErrors[field] || field === 'confirmPassword') {
          if (fieldMessage) nextErrors[field] = fieldMessage
          else delete nextErrors[field]
        }
        if (!isLogin && (field === 'password' || field === 'confirmPassword') && (currentErrors.confirmPassword || nextForm.confirmPassword)) {
          const confirmMessage = validateAuthField('confirmPassword', nextForm, isLogin)
          if (confirmMessage) nextErrors.confirmPassword = confirmMessage
          else delete nextErrors.confirmPassword
        }
        return nextErrors
      })
      return nextForm
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const errors = validateAuthForm(form, isLogin)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setState({ loading: true, error: '' })
    try {
      if (isLogin) {
        await login(form.email.trim(), form.password)
      } else {
        await register({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          role: 'CONTRIBUTOR',
        })
      }
    } catch (error) {
      const serverFieldErrors = mapServerFieldErrors(error)
      if (Object.keys(serverFieldErrors).length > 0) setFieldErrors(serverFieldErrors)
      setState({
        loading: false,
        error: Object.keys(serverFieldErrors).length > 0
          ? ''
          : sanitizeServerMessage(error.message, isLogin ? 'Sign in failed.' : 'Registration failed.'),
      })
      return
    }
    setState({ loading: false, error: '' })
  }

  return (
    <main className="authModernShell">
      <section className="authModernPanel authModernVisual" aria-label="PolitikApp authentication overview">
        <div className="authShape authShapeOne" />
        <div className="authShape authShapeTwo" />
        <div className="authShape authShapeThree" />
        <div className="authBrandBlock">
          <p className="authBrandKicker">PolitikApp</p>
          <h1>Evidence-first civic accountability.</h1>
          <p>Track public servants through source-backed records, audit trails, and governance indicators.</p>
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
            <p>{isLogin ? 'Enter your credentials to continue reviewing public governance records.' : 'Create a citizen contributor account to submit and track evidence-backed records.'}</p>
          </div>

          <div className={`authModeTabs ${isLogin ? 'is-login' : 'is-register'}`} role="tablist" aria-label="Authentication mode">
            <button type="button" id="auth-tab-login" className={isLogin ? 'active' : ''} onClick={() => switchMode('login')}>Sign In</button>
            <button type="button" id="auth-tab-register" className={!isLogin ? 'active' : ''} onClick={() => switchMode('register')}>Create Account</button>
          </div>

          <form className="authModernForm" onSubmit={handleSubmit} noValidate>
            {!isLogin && <AuthField autoComplete="name" error={fieldErrors.fullName} icon={<UserIcon />} id="auth-fullname-input" label="Name" placeholder="e.g. Maria" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} />}
            <AuthField autoComplete={isLogin ? 'username' : 'email'} error={fieldErrors.email} icon={isLogin ? <UserIcon /> : <MailIcon />} id="auth-login-input" label={isLogin ? 'Email or Username' : 'Email Address'} placeholder={isLogin ? 'username or email@domain.com' : 'citizen@domain.gov.ph'} value={form.email} onChange={(e) => updateField('email', e.target.value)} />
            {!isLogin && <AuthField autoComplete="username" error={fieldErrors.username} icon={<UserIcon />} id="auth-username-input" label="Choose Username" placeholder="e.g. maria_santos" value={form.username} onChange={(e) => updateField('username', e.target.value)} />}

            <label className="authField" htmlFor="auth-password-input">
              <span className="authFieldLabel">Password</span>
              <span className={`authFieldControl${fieldErrors.password && isLogin ? ' hasError' : ''}`}>
                <span className="authFieldIcon"><LockIcon size={20} /></span>
                <input autoComplete={isLogin ? 'current-password' : 'new-password'} id="auth-password-input" onChange={(e) => updateField('password', e.target.value)} placeholder="Enter your password" required type={showPassword ? 'text' : 'password'} value={form.password} aria-invalid={Boolean(fieldErrors.password && isLogin)} aria-describedby={fieldErrors.password && isLogin ? 'auth-password-input-error' : undefined} />
                <button type="button" className="authPasswordToggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}><EyeIcon hidden={showPassword} /></button>
              </span>
              {fieldErrors.password && isLogin && <span className="authFieldError" id="auth-password-input-error">{fieldErrors.password}</span>}
            </label>

            {!isLogin && (
              <>
                <div className="authPasswordChecklist" aria-live="polite">
                  <p className="authChecklistTitle">Password requirements</p>
                  <ul>{passwordRequirements.map((requirement) => <RequirementItem key={requirement.id} met={requirement.met}>{requirement.label}</RequirementItem>)}</ul>
                </div>
                <label className="authField" htmlFor="auth-confirm-password-input">
                  <span className="authFieldLabel">Confirm Password</span>
                  <span className={`authFieldControl${fieldErrors.confirmPassword ? ' hasError' : ''}`}>
                    <span className="authFieldIcon"><LockIcon size={20} /></span>
                    <input autoComplete="new-password" id="auth-confirm-password-input" onChange={(e) => updateField('confirmPassword', e.target.value)} placeholder="Confirm your password" required type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? 'auth-confirm-password-input-error' : undefined} />
                    <button type="button" className="authPasswordToggle" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}><EyeIcon hidden={showConfirmPassword} /></button>
                  </span>
                  {form.confirmPassword && <span className={`authMatchMessage${passwordsMatch ? ' isMatch' : ''}`} id="auth-confirm-password-input-error">{passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}</span>}
                  {fieldErrors.confirmPassword && !form.confirmPassword && <span className="authFieldError">{fieldErrors.confirmPassword}</span>}
                </label>
              </>
            )}

            {state.error && <div className="authAlert error"><AlertTriangleIcon size={16} /><span>{state.error}</span></div>}
            <button id="auth-submit-btn" className="authSubmitButton" type="submit" disabled={state.loading}>
              {state.loading ? <span className="authSubmitLoading"><span className="authSubmitSpinner" aria-hidden="true" />{isLogin ? 'Signing in...' : 'Creating account...'}</span> : isLogin ? 'Sign In' : 'Create Account'}
            </button>
            <p className="authFormFooter">{isLogin ? "Don't have an account?" : 'Already have an account?'}<button type="button" onClick={() => switchMode(isLogin ? 'register' : 'login')}>{isLogin ? 'Create one' : 'Sign in'}</button></p>
          </form>
        </div>
      </section>
    </main>
  )
}
