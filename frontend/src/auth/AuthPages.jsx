import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function AuthPages() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [state, setState] = useState({ loading: false, error: '', success: '' })
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    setState({ loading: true, error: '', success: '' })
    try {
      if (mode === 'login') {
        await login(form.email || form.username, form.password)
      } else {
        await register({ ...form, role: 'CONTRIBUTOR' })
        setState({ loading: false, error: '', success: 'Registration successful.' })
      }
    } catch (error) {
      setState({ loading: false, error: error.message, success: '' })
      return
    }
    setState((current) => ({ ...current, loading: false }))
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="ty-page-title">{mode === 'login' ? 'Login' : 'Register'}</h1>
        <p className="ty-body mt-1">PolitikApp account access</p>
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input className="w-full rounded-md border border-slate-300 p-2" placeholder="Full name" required value={form.fullName} onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))} />
          )}
          <input className="w-full rounded-md border border-slate-300 p-2" placeholder={mode === 'login' ? 'Email or username' : 'Email'} required value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          {mode === 'register' && (
            <input className="w-full rounded-md border border-slate-300 p-2" placeholder="Username" required value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} />
          )}
          <input className="w-full rounded-md border border-slate-300 p-2" placeholder="Password" required type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
          {state.error && <p className="ty-body text-red-600">{state.error}</p>}
          {state.success && <p className="ty-body text-emerald-600">{state.success}</p>}
          <button className="w-full rounded-md bg-slate-900 p-2 text-white disabled:opacity-60" disabled={state.loading} type="submit">
            {state.loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
        <button className="ty-nav mt-4 text-slate-700 underline" onClick={() => setMode((m) => (m === 'login' ? 'register' : 'login'))} type="button">
          {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
        </button>
      </section>
    </main>
  )
}
