import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { SkeletonLine } from '../../components/Skeletons'
import './Account.css'

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

function initialsFor(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
}

function AccountCardSkeleton() {
  return (
    <div className="settingsCard accountCardSkeleton" aria-hidden="true">
      <SkeletonLine width="42%" height={18} />
      <SkeletonLine width="78%" height={12} className="mt-3" />
      <SkeletonLine width="100%" height={46} className="mt-5" />
      <SkeletonLine width="34%" height={42} className="mt-5" />
    </div>
  )
}

export default function Account({ embedded = false, token, user }) {
  const { updateSession } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [form, setForm] = useState({ fullName: '' })

  useEffect(() => {
    let cancelled = false
    setProfileLoading(true)
    setState({ status: 'idle', message: '' })
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
        setForm({ fullName: data.fullName || '' })
        setState({ status: 'success', message: '' })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message || 'Failed to load profile.' })
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [token, updateSession])

  async function onSave(event) {
    event.preventDefault()
    setState({ status: 'saving', message: '' })
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
    <section className={embedded ? 'settingsWorkspace embeddedProfileDetails' : 'workspace settingsWorkspace'}>
      {!embedded && (
        <header className="settingsHeader">
          <div className="settingsHeaderCopy">
            <p className="ty-page-kicker">Profile</p>
            <h2 className="ty-page-title">Manage your profile</h2>
            <p className="ty-body">Keep your public identity and account details up to date.</p>
          </div>
        </header>
      )}

      <div className="settingsLayout">
        {profileLoading && !profile ? (
          <>
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </>
        ) : <form className="settingsCard settingsForm" onSubmit={onSave}>
          <div className="settingsCardHeader">
            <h3>Profile details</h3>
            <p>These details are used across your civic contribution activity.</p>
          </div>
          <div className="settingsFormFields">
            <label>Name<input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
          </div>
          <div className="settingsFormFooter">
            <StatusLine state={state} />
            <button type="submit" disabled={profileLoading || state.status === 'saving'}>
              {state.status === 'saving' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>}

        {!profileLoading && <aside className="settingsCard settingsInfoCard" aria-label="Account overview">
          <div className="settingsIdentity">
            <span className="settingsAvatar" aria-hidden="true">{initialsFor(profile?.fullName || user?.fullName)}</span>
            <div className="settingsIdentityText">
              <strong>{profile?.fullName || user?.fullName || 'Your profile'}</strong>
              <span>{profile?.email || user?.email || 'Email unavailable'}</span>
            </div>
          </div>
          <div className="settingsInfoBlock">
            <h3>Account overview</h3>
            <dl className="settingsInfoList">
              <div className="settingsInfoRow"><dt>Role</dt><dd>{profile?.role || user?.role || '—'}</dd></div>
              <div className="settingsInfoRow"><dt>Status</dt><dd><span className="settingsStatus">{profile?.accountStatus || profile?.status || 'Active'}</span></dd></div>
            </dl>
          </div>
        </aside>}
      </div>
    </section>
  )
}
