import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../api/client'
import { BookmarkIcon, CircleCheckIcon, MessageCircleIcon } from './icons/Lucide'
import './ProfileMatrix.css'
import NewsArticleReader from './NewsArticleReader'


const TABS = [
  { id: 'comments', label: 'Comments', Icon: MessageCircleIcon },
  { id: 'saved', label: 'Saved', Icon: BookmarkIcon },
]

async function fetchJson(path, token) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  return readApiResponse(response)
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

function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date) : ''
}

function formatStatus(value) {
  const text = String(value || 'ACTIVE').toLowerCase().replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function settledItems(result) {
  return result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : []
}

function settledError(result) {
  return result.status === 'rejected' ? result.reason?.message || 'Request failed.' : ''
}

function ActivityCard({ kind, title, body, date }) {
  const isComment = kind === 'comment'
  const Icon = isComment ? MessageCircleIcon : BookmarkIcon
  const parsed = parseDate(date)
  return (
    <article className={`profileCard ${isComment ? 'comment' : 'saved'}`}>
      <div className="profileCardMeta">
        <span className="profileCardIcon" aria-hidden="true"><Icon size={19} /></span>
        <div>
          <strong>{isComment ? 'You commented on' : 'Saved update'}</strong>
          {parsed && <time dateTime={parsed.toISOString()}>{formatDate(date)}</time>}
        </div>
        <span className="profileCardPill">{isComment ? 'Comment' : 'Saved'}</span>
      </div>
      <h2 className="profileCardTitle">{title}</h2>
      {body && <p className={isComment ? 'profileCardQuote' : 'profileCardText'}>{body}</p>}
    </article>
  )
}

function CardSkeleton() {
  return (
    <div className="profileCardList" aria-hidden="true">
      {[0, 1, 2].map((key) => (
        <div className="profileCard isSkeleton" key={key}>
          <i style={{ width: '32%' }} />
          <i style={{ width: '78%' }} />
          <i style={{ width: '56%' }} />
        </div>
      ))}
    </div>
  )
}

function Notice({ Icon, title, hint, error, onRetry }) {
  return (
    <div className={`profileNotice${error ? ' error' : ''}`} role={error ? 'alert' : undefined}>
      {Icon && <span className="profileNoticeIcon" aria-hidden="true"><Icon size={20} /></span>}
      <strong>{title}</strong>
      <span>{hint}</span>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export default function UserProfileMatrixPanel({ token, user }) {
  const [readingId, setReadingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [saveError, setSaveError] = useState('')
  async function unsave(id) {
    setSavingId(id)
    setSaveError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/news/${id}/save`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Could not remove saved article. Please try again.')
      setActivity(current => ({ ...current, saved: current.saved.filter(item => item.id !== id) }))
    } catch (error) { setSaveError(error.message) }
    finally { setSavingId(null) }
  }
  const [profile, setProfile] = useState(user)
  const [tab, setTab] = useState('comments')
  const [reloadKey, setReloadKey] = useState(0)
  const [activity, setActivity] = useState({
    loading: true,
    comments: [],
    saved: [],
    errors: { comments: '', saved: '' },
  })
  const tabRefs = useRef({})

  useEffect(() => {
    let cancelled = false
    setActivity((current) => ({ ...current, loading: true }))
    Promise.allSettled([
      fetchJson('/users/me', token),
      fetchJson('/api/me/comments', token),
      fetchJson('/api/me/saved-posts', token),
    ]).then(([me, comments, saved]) => {
      if (cancelled) return
      if (me.status === 'fulfilled') setProfile(me.value)
      setActivity({
        loading: false,
        comments: settledItems(comments),
        saved: settledItems(saved),
        errors: { comments: settledError(comments), saved: settledError(saved) },
      })
    })
    return () => { cancelled = true }
  }, [token, reloadKey])

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  const handleTabKeyDown = useCallback((event, index) => {
    const last = TABS.length - 1
    const nextIndex = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key]
    if (nextIndex === undefined) return
    event.preventDefault()
    const next = TABS[nextIndex]
    setTab(next.id)
    tabRefs.current[next.id]?.focus()
  }, [])

  const actor = profile || user || {}
  const statusLabel = formatStatus(actor.accountStatus || actor.status)
  const isActive = statusLabel.toLowerCase() === 'active'
  const hasTrust = actor.trustScore !== undefined && actor.trustScore !== null

  const countFor = (id) => (activity.loading || activity.errors[id] ? null : activity[id].length)
  const items = activity[tab]
  const tabError = activity.errors[tab]

  return (
    <section className="profileShell">
      <header className="profileHero">
        <div className="profileHeroTop">
          <div className="profileAvatar" aria-hidden="true">{initialsFor(actor)}</div>
          <div className="profileIdentity">
            <h1>{actor.fullName || actor.username || 'Civic member'}</h1>
            <p>@{actor.username || 'user'}</p>
          </div>
          <span className={`profileStatus${isActive ? '' : ' isInactive'}`}>
            <CircleCheckIcon size={14} /> {statusLabel}
          </span>
        </div>

        {hasTrust && (
          <div className="profileStats">
            <div className="profileStat">
              <span className="profileStatIcon"><CircleCheckIcon size={15} /></span>
              <div><strong>{actor.trustScore}</strong><span>Trust score</span></div>
            </div>
          </div>
        )}
      </header>

      <div className="profileBody">
        {readingId && <NewsArticleReader id={readingId} token={token} onClose={() => setReadingId(null)} />}
        {saveError && <p role="alert">{saveError}</p>}
        <div className="profileMain">
          <div className="profileControls">
            <div className="profileTabs" role="tablist" aria-label="Your activity">
              {TABS.map(({ id, label, Icon }, index) => {
                const selected = tab === id
                const count = countFor(id)
                return (
                  <button
                    key={id}
                    ref={(node) => { tabRefs.current[id] = node }}
                    type="button"
                    role="tab"
                    id={`profile-tab-${id}`}
                    aria-selected={selected}
                    aria-controls={`profile-panel-${id}`}
                    tabIndex={selected ? 0 : -1}
                    className={`profileTab${selected ? ' active' : ''}`}
                    onClick={() => setTab(id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    <Icon size={15} />
                    {label}
                    {count !== null && <span className="profileTabCount">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`} aria-live="polite">
            {activity.loading && <CardSkeleton />}

            {!activity.loading && tabError && (
              <Notice error title="We couldn’t load this list" hint={tabError} onRetry={retry} />
            )}

            {!activity.loading && !tabError && items.length === 0 && (
              tab === 'comments'
                ? <Notice Icon={MessageCircleIcon} title="No comments yet" hint="Join a discussion on any government update and your comments will show up here." />
                : <Notice Icon={BookmarkIcon} title="Nothing saved yet" hint="Bookmark an update to keep it here for later." />
            )}

            {!activity.loading && !tabError && items.length > 0 && (
              <div className="profileCardList">
                {tab === 'comments'
                  ? items.map((item) => (
                    <ActivityCard key={item.id} kind="comment" title={item.articleTitle} body={item.content} date={item.createdAt} />
                  ))
                  : items.map((item) => (
                    <div key={item.id}>
                      <ActivityCard kind="saved" title={item.headline || item.originalTitle} body={item.summary || 'Saved government update.'} date={item.publishedAt} />
                      <button onClick={() => setReadingId(item.id)}>Read article</button>
                      <button disabled={savingId === item.id} onClick={() => unsave(item.id)}>{savingId === item.id ? 'Removing...' : 'Unsave'}</button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </section>
  )
}
