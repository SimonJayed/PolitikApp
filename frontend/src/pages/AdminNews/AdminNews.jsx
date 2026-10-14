import { useEffect, useMemo, useState } from 'react'
import {
  CircleXIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from '../../components/icons/Lucide'
import './AdminNews.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const statuses = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'FAILED']
const categories = ['Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']

async function readApiResponse(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `Request failed with status ${response.status}`)
  return body
}

function formatDate(value) {
  if (!value) return 'Unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function displayStatus(status) {
  return String(status || 'PENDING_REVIEW').replaceAll('_', ' ')
}

function truncate(value, max = 92) {
  if (!value) return 'Untitled article'
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value
}

export default function AdminNews({ token, user }) {
  const [status, setStatus] = useState('ALL')
  const [summary, setSummary] = useState({ pendingReview: 0, publishedArticles: 0, rejectedArticles: 0 })
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [draft, setDraft] = useState({ suggestedTitle: '', aiSummary: '', category: 'Government Announcements', reviewNotes: '' })
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [actionState, setActionState] = useState({ status: 'idle', message: '' })

  const isAdmin = user?.role === 'ADMIN'
  const busy = state.status === 'loading' || actionState.status === 'loading'
  const isMockOutput = selected?.aiProcessingStatus === 'MOCKED'

  useEffect(() => {
    if (!isAdmin || !token) return
    loadDashboard()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, status])

  useEffect(() => {
    if (!selectedId || !token) return
    loadArticle(selectedId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, token])

  useEffect(() => {
    if (!selected) return
    setDraft({
      suggestedTitle: selected.headline || selected.originalTitle || '',
      aiSummary: selected.summary || '',
      category: selected.category || 'Government Announcements',
      reviewNotes: selected.reviewNotes || '',
    })
  }, [selected])

  const selectedIndex = useMemo(() => items.findIndex((item) => item.id === selectedId), [items, selectedId])

  async function loadDashboard() {
    setState({ status: 'loading', message: 'Loading admin dashboard...' })
    try {
      const [summaryData, queueData] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/news/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(readApiResponse),
        fetch(`${API_BASE_URL}/api/admin/news?status=${encodeURIComponent(status)}&size=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(readApiResponse),
      ])
      const nextItems = Array.isArray(queueData.content) ? queueData.content : []
      setSummary(summaryData)
      setItems(nextItems)
      setSelectedId((current) => (current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null))
      setState({ status: 'success', message: '' })
    } catch (error) {
      setItems([])
      setState({ status: 'error', message: error.message })
    }
  }

  async function loadArticle(id) {
    setActionState({ status: 'loading', message: 'Loading article...' })
    try {
      const data = await fetch(`${API_BASE_URL}/api/admin/news/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(readApiResponse)
      setSelected(data)
      setActionState({ status: 'idle', message: '' })
    } catch (error) {
      setActionState({ status: 'error', message: error.message })
    }
  }

  async function fetchLatest() {
    setActionState({ status: 'loading', message: 'Fetching latest government articles...' })
    try {
      const result = await fetch(`${API_BASE_URL}/api/admin/news/fetch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(readApiResponse)
      setActionState({ status: 'success', message: `Retrieved ${result.retrieved}, skipped ${result.skipped}, failed ${result.failed}.` })
      await loadDashboard()
    } catch (error) {
      setActionState({ status: 'error', message: error.message })
    }
  }

  async function saveEdits() {
    if (!selected) return
    setActionState({ status: 'loading', message: 'Saving review edits...' })
    try {
      const updated = await fetch(`${API_BASE_URL}/api/admin/news/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      }).then(readApiResponse)
      setSelected(updated)
      await loadDashboard()
      setActionState({ status: 'success', message: 'Review edits saved.' })
    } catch (error) {
      setActionState({ status: 'error', message: error.message })
    }
  }

  async function runAction(path, options = {}) {
    if (!selected) return
    setActionState({ status: 'loading', message: options.loading || 'Updating article...' })
    try {
      const updated = await fetch(`${API_BASE_URL}/api/admin/news/${selected.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: options.body ? JSON.stringify(options.body) : undefined,
      }).then(readApiResponse)
      setSelected(updated)
      await loadDashboard()
      setActionState({ status: 'success', message: options.success || 'Article updated.' })
    } catch (error) {
      setActionState({ status: 'error', message: error.message })
    }
  }

  if (!isAdmin) {
    return (
      <section className="adminNewsShell">
        <div className="adminNewsNotice error">Admin access is required for news verification.</div>
      </section>
    )
  }

  return (
    <section className="adminNewsShell">
      <header className="adminNewsHeader">
        <div>
          <p className="ty-page-kicker">Administrator dashboard</p>
          <h1 className="ty-page-title">News Review</h1>
        </div>
        <button disabled={busy} type="button" onClick={fetchLatest}>
          <RefreshCwIcon size={17} />
          <span>Fetch Latest News</span>
        </button>
      </header>

      <section className="adminSummaryGrid" aria-label="News review summary">
        <article>
          <span>Pending Review</span>
          <strong>{summary.pendingReview ?? 0}</strong>
        </article>
        <article>
          <span>Published Articles</span>
          <strong>{summary.publishedArticles ?? 0}</strong>
        </article>
        <article>
          <span>Rejected Articles</span>
          <strong>{summary.rejectedArticles ?? 0}</strong>
        </article>
      </section>

      <div className="adminNewsToolbar" aria-label="Article status filter">
        {statuses.map((item) => (
          <button className={status === item ? 'active' : ''} key={item} onClick={() => setStatus(item)} type="button">
            {displayStatus(item)}
          </button>
        ))}
      </div>

      {state.message && <div className={`adminNewsNotice ${state.status}`}>{state.message}</div>}
      {actionState.message && <div className={`adminNewsNotice ${actionState.status}`}>{actionState.message}</div>}

      <section className="adminArticleTableWrap" aria-label="Administrative article queue">
        {items.length === 0 && state.status !== 'loading' && (
          <div className="adminEmpty">
            <FileTextIcon size={24} />
            <span>No articles in this queue.</span>
          </div>
        )}
        {items.length > 0 && (
          <table className="adminArticleTable">
            <thead>
              <tr>
                <th>Headline</th>
                <th>Source</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className={item.id === selectedId ? 'selected' : ''} key={item.id}>
                  <td>{truncate(item.originalTitle || item.headline)}</td>
                  <td>{item.sourceName || 'Government source'}</td>
                  <td>{formatDate(item.originalPublishedAt)}</td>
                  <td><span className="statusPill">{displayStatus(item.status)}</span></td>
                  <td>
                    <button type="button" onClick={() => setSelectedId(item.id)}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <main className="adminReviewPanel">
        {!selected && <div className="adminEmpty">Select an article to review.</div>}
        {selected && (
          <>
            <div className="reviewMeta">
              <span>{displayStatus(selected.status)}</span>
              <span>AI: {selected.aiProcessingStatus || 'Not processed'}</span>
              {isMockOutput && <span className="mockPill">Mock-generated</span>}
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon size={15} />
                Original source
              </a>
            </div>

            <div className="adminReviewSplit">
              <section className="sourcePreview">
                <p className="panelKicker">Original government article</p>
                <h2>{selected.originalTitle}</h2>
                <dl className="articleFacts">
                  <div><dt>Source</dt><dd>{selected.sourceName || 'Government source'}</dd></div>
                  <div><dt>Publication Date</dt><dd>{formatDate(selected.originalPublishedAt)}</dd></div>
                  <div><dt>URL</dt><dd><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.sourceUrl}</a></dd></div>
                </dl>
                <p>{selected.originalContent || 'The RSS feed did not include full article text. Open the original source before approving.'}</p>
              </section>

              <section className="reviewForm">
                <p className="panelKicker">AI-generated review draft</p>
                <label>
                  Headline
                  <input value={draft.suggestedTitle} onChange={(event) => setDraft((current) => ({ ...current, suggestedTitle: event.target.value }))} />
                </label>

                <label>
                  Summary
                  <textarea rows={7} value={draft.aiSummary} onChange={(event) => setDraft((current) => ({ ...current, aiSummary: event.target.value }))} />
                </label>

                <label>
                  Category
                  <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>

                {selected.keyPoints?.length > 0 && (
                  <div className="keyPointPreview">
                    <span>Key Points</span>
                    <ul>{selected.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                  </div>
                )}

                <label>
                  Review notes
                  <textarea rows={4} value={draft.reviewNotes} onChange={(event) => setDraft((current) => ({ ...current, reviewNotes: event.target.value }))} />
                </label>
              </section>
            </div>

            <footer className="reviewActions">
              <button disabled={busy} type="button" onClick={saveEdits}>Save Edits</button>
              <button disabled={busy} type="button" onClick={() => runAction('process-ai', { loading: 'Processing article with AI...', success: 'AI processing completed. Review the result before publishing.' })}>Process with AI</button>
              <button disabled={busy} type="button" onClick={() => runAction('approve', { success: 'Article approved. Publish separately when ready.' })}>
                <ShieldCheckIcon size={16} />
                Approve
              </button>
              <button disabled={busy} type="button" onClick={() => runAction('reject', { body: { reason: draft.reviewNotes || 'Rejected by admin.' }, success: 'Article rejected.' })}>
                <CircleXIcon size={16} />
                Reject
              </button>
              <button disabled={busy} type="button" onClick={() => runAction('publish', { success: 'Article published.' })}>Publish</button>
              <button disabled={busy} type="button" onClick={() => runAction('unpublish', { success: 'Article unpublished.' })}>Unpublish</button>
            </footer>

            {selectedIndex >= 0 && <p className="ty-meta">Article {selectedIndex + 1} of {items.length}</p>}
          </>
        )}
      </main>
    </section>
  )
}
