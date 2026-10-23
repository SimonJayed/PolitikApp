import { useEffect, useState } from 'react'
import { BookmarkIcon, CircleCheckIcon, MessageCircleIcon } from './icons/Lucide'
import './ProfileMatrix.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Request failed.')
  return body
}

function initialsFor(user) {
  return (user?.fullName || user?.username || 'User')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : ''
}

export default function UserProfileMatrixPanel({ token, user }) {
  const [profile, setProfile] = useState(user)
  const [tab, setTab] = useState('comments')
  const [content, setContent] = useState({ status: 'loading', message: '', comments: [], saved: [] })

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch(`${API_BASE_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }).then(readApiResponse),
      fetch(`${API_BASE_URL}/api/me/comments`, { headers: { Authorization: `Bearer ${token}` } }).then(readApiResponse),
      fetch(`${API_BASE_URL}/api/me/saved-posts`, { headers: { Authorization: `Bearer ${token}` } }).then(readApiResponse),
    ])
      .then(([liveProfile, comments, saved]) => {
        if (!cancelled) {
          setProfile(liveProfile)
          setContent({ status: 'success', message: '', comments, saved })
        }
      })
      .catch((error) => {
        if (!cancelled) setContent((current) => ({ ...current, status: 'error', message: error.message }))
      })
    return () => { cancelled = true }
  }, [token])

  const actor = profile || user || {}
  return (
    <section className="workspace profileMatrixWorkspace">
      <header className="socialProfileHeader">
        <div className="socialProfileAvatar" aria-hidden="true">{initialsFor(actor)}</div>
        <div className="socialProfileIdentity">
          <h1>{actor.fullName || actor.username || 'Civic member'}</h1>
          <p>@{actor.username || 'user'}</p>
          <span className="profileMatrixStatus"><CircleCheckIcon size={14} /> {actor.accountStatus || actor.status || 'ACTIVE'}</span>
        </div>
      </header>

      <div className="socialProfileTabs" role="tablist" aria-label="Profile activity">
        <button type="button" className={tab === 'comments' ? 'active' : ''} onClick={() => setTab('comments')}><MessageCircleIcon size={16} /> Replies / Comments</button>
        <button type="button" className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}><BookmarkIcon size={16} /> Saved</button>
      </div>

      {content.status === 'loading' && <div className="profileMatrixState">Loading your activity...</div>}
      {content.status === 'error' && <div className="profileMatrixState isError">{content.message}</div>}
      {content.status === 'success' && tab === 'comments' && (
        content.comments.length
          ? <div className="socialActivityList">{content.comments.map((item) => <article className="socialActivityCard" key={item.id}><div className="socialActivityIcon"><MessageCircleIcon size={17} /></div><div><strong>{item.articleTitle}</strong><p>{item.content}</p><time>{formatDate(item.createdAt)}</time></div></article>)}</div>
          : <div className="profileMatrixState">No comments yet.</div>
      )}
      {content.status === 'success' && tab === 'saved' && (
        content.saved.length
          ? <div className="socialActivityList">{content.saved.map((item) => <article className="socialActivityCard" key={item.id}><div className="socialActivityIcon"><BookmarkIcon size={17} /></div><div><strong>{item.headline || item.originalTitle}</strong><p>{item.summary || 'Saved government update.'}</p><time>{formatDate(item.publishedAt)}</time></div></article>)}</div>
          : <div className="profileMatrixState">No saved posts yet.</div>
      )}
    </section>
  )
}
