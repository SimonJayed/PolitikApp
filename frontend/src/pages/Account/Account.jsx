import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed with status ${response.status}`)
  return body
}

function StatusLine({ state }) {
  if (!state?.message) return null
  return <p className={`statusLine ${state.status === 'error' ? 'isError' : ''}`}>{state.message}</p>
}

export default function Account({ token, user }) {
  const { updateSession } = useAuth()
  const [profile, setProfile] = useState(null)
  const [state, setState] = useState({ status: 'loading', message: 'Loading profile...' })
  const [form, setForm] = useState({ fullName: '', username: '' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', message: 'Loading profile...' })
    fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          updateSession(null)
          throw new Error('Session expired or unauthorized')
        }
        return readApiResponse(res)
      })
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        setForm({ fullName: data.fullName || '', username: data.username || '' })
        setState({ status: 'success', message: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message || 'Failed to load profile.' })
      })
    return () => { cancelled = true }
  }, [token, updateSession])

  async function onSave(event) {
    event.preventDefault()
    setState({ status: 'loading', message: 'Saving profile...' })
    try {
      const data = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      }).then(readApiResponse)
      setProfile(data.user || data)
      updateSession(data)
      setState({ status: 'success', message: 'Profile updated.' })
    } catch (error) {
      setState({ status: 'error', message: error.message })
    }
  }

  return (
    <section className="workspace">
      <section className="profileSummary">
        <p className="eyebrow ty-page-kicker">Account</p>
        <h2 className="ty-section-title">{profile?.fullName || user?.fullName || '—'}</h2>
        <p className="ty-body">{profile?.email || user?.email || '—'}</p>
        <p className="ty-body">Role: {profile?.role || user?.role || '—'}</p>
      </section>
      <form className="editorPanel" onSubmit={onSave}>
        <label>Full Name<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
        <label>Username<input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></label>
        <button type="submit" disabled={state.status === 'loading'}>Save Changes</button>
      </form>
      <StatusLine state={state} />
    </section>
  )
}
