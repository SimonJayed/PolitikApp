import { useEffect, useMemo, useState } from 'react'
import { canProcessAi, canRejectArticle, planBulkNewsAction, runConcurrentNewsActions } from '../../features/news/newsWorkflow'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import {
  CircleXIcon,
  ExternalLinkIcon,
  FileTextIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from '../../components/icons/Lucide'
import './AdminNews.css'
import SourceManager from './SourceManager'
import { PageSkeleton, PaginationMini } from '../pageHelpers'

const statuses = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED', 'RETRIEVED', 'PROCESSING', 'FAILED']
const bulkActions = [
  { path: 'approve', label: 'Approve', progress: 'Approving', past: 'approved', tone: 'Approve' },
  { path: 'publish', label: 'Publish', progress: 'Publishing', past: 'published', tone: 'Publish' },
  { path: 'unpublish', label: 'Unpublish', progress: 'Unpublishing', past: 'unpublished', tone: 'Unpublish' },
  { path: 'reject', label: 'Reject', progress: 'Rejecting', past: 'rejected', tone: 'Reject' },
]
const categories = ['Legislation', 'Government Projects', 'Public Spending', 'Audit Reports', 'Government Announcements']

function formatDate(value) {
  if (!value) return 'Unavailable'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function displayStatus(status) {
  return String(status || 'PENDING_REVIEW').replaceAll('_', ' ')
}

function statusTone(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'PUBLISHED') return 'published'
  if (value === 'APPROVED') return 'approved'
  if (value === 'REJECTED') return 'rejected'
  if (value === 'FAILED') return 'failed'
  if (value === 'UNPUBLISHED') return 'muted'
  return 'pending'
}

function truncate(value, max = 92) {
  if (!value) return 'Untitled article'
  return value.length > max ? `${value.slice(0, max - 1).trim()}...` : value
}

export default function AdminNews({ token, user, politicians = [] }) {
  const [status, setStatus] = useState('ALL')
  const [summary, setSummary] = useState({ pendingReview: 0, publishedArticles: 0, rejectedArticles: 0 })
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(0)
  const [retrieving, setRetrieving] = useState(false)
  const [sourceRefresh, setSourceRefresh] = useState(0)
  const [fetchResult, setFetchResult] = useState(null)
  const [manualSources, setManualSources] = useState([])
  const [manualSourceId, setManualSourceId] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [manualTitle, setManualTitle] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [manualResult, setManualResult] = useState(null)
  const [totalPages, setTotalPages] = useState(1)
  const [draft, setDraft] = useState({ suggestedTitle: '', aiSummary: '', category: 'Government Announcements', reviewNotes: '' })
  const [state, setState] = useState({ status: 'idle', message: '' })
  const [actionState, setActionState] = useState({ status: 'idle', message: '' })
  const [bulkProgress, setBulkProgress] = useState(null)

  const isAdmin = user?.role === 'ADMIN'
  const busy = state.status === 'loading' || actionState.status === 'loading' || Boolean(bulkProgress)
  const bulkPlans = Object.fromEntries(bulkActions.map(action => [action.path, planBulkNewsAction(items, selectedIds, action.path)]))
  const isMockOutput = selected?.aiProcessingStatus === 'MOCKED'
  const isDeterministic = selected?.aiProcessingStatus === 'DETERMINISTIC'
  const isIncomplete = selected?.aiProcessingStatus === 'INCOMPLETE'
  const dirty = selected && (draft.suggestedTitle !== (selected.headline || '') || draft.aiSummary !== (selected.summary || '')
    || draft.category !== selected.category || draft.reviewNotes !== (selected.reviewNotes || '')
    || (draft.keyPointsText || '') !== (selected.keyPoints || []).join('\n')
    || JSON.stringify(draft.relatedPoliticianIds || []) !== JSON.stringify((selected.relatedPoliticians || []).map(p => p.id)))

  useEffect(() => {
    if (!retrieving) return
    let cancelled = false
    const timer = window.setInterval(async () => {
      try {
        const job = await fetch(`${API_BASE_URL}/api/admin/news/fetch-status`, { headers: { Authorization: `Bearer ${token}` } }).then(readApiResponse)
        if (cancelled || job.state === 'RUNNING') return
        setRetrieving(false)
        if (job.state === 'COMPLETED') {
          setFetchResult(job.result)
          setActionState({ status: 'success', message: `Retrieved ${job.result.retrieved} complete and ${job.result.incomplete} incomplete articles; ${job.result.irrelevant || 0} outside PolitikApp's news focus, ${job.result.duplicates} duplicates, ${job.result.blocked} access-denied requests, ${job.result.notRetried} not retried, ${job.result.failed} failed.` })
          loadDashboard()
          setSourceRefresh(value => value + 1)
        } else setActionState({ status: 'error', message: job.message || 'Retrieval ended before completion. Check the queue before retrying.' })
      } catch (error) { if (!cancelled) { setRetrieving(false); setActionState({ status: 'error', message: error.message }) } }
    }, 2000)
    return () => { cancelled = true; window.clearInterval(timer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retrieving, token])

  useEffect(() => {
    if (!isAdmin || !token) return
    fetch(`${API_BASE_URL}/api/admin/news/sources`, { headers: { Authorization: `Bearer ${token}` } })
      .then(readApiResponse).then(rows => {
        const active = rows.filter(source => source.active)
        setManualSources(active)
        setManualSourceId(current => active.some(source => source.id === current) ? current : active[0]?.id || '')
      }).catch(error => setActionState({ status: 'error', message: error.message }))
  }, [isAdmin, token, sourceRefresh])

  useEffect(() => {
    if (!isAdmin || !token) return
    loadDashboard()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, token, status, page])

  useEffect(() => {
    // Queue responses already contain the complete review fields.
    setSelected(items.find(item => item.id === selectedId) || null)
  }, [selectedId, items])

  useEffect(() => {
    if (!selected) return
    setDraft({
      suggestedTitle: selected.headline || selected.originalTitle || '',
      aiSummary: selected.summary || '',
      category: selected.category || 'Government Announcements',
      reviewNotes: selected.reviewNotes || '',
      relatedPoliticianIds: (selected.relatedPoliticians || []).map(p => p.id),
      keyPointsText: (selected.keyPoints || []).join('\n'),
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
        fetch(`${API_BASE_URL}/api/admin/news?status=${encodeURIComponent(status)}&size=20&page=${page}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(readApiResponse),
      ])
      const nextItems = Array.isArray(queueData.content) ? queueData.content : []
      setSummary(summaryData)
      setItems(nextItems)
      const nextTotalPages = Math.max(1, queueData.totalPages || 1)
      setTotalPages(nextTotalPages)
      if (page >= nextTotalPages) setPage(nextTotalPages - 1)
      setSelectedId((current) => (current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id || null))
      setSelectedIds((current) => current.filter((id) => nextItems.some((item) => item.id === id)))
      setState({ status: 'success', message: '' })
    } catch (error) {
      setItems([])
      setState({ status: 'error', message: error.message })
    }
  }

  async function fetchLatest() {
    setFetchResult(null)
    setActionState({ status: 'loading', message: 'Fetching latest government articles...' })
    try {
      await fetch(`${API_BASE_URL}/api/admin/news/fetch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(readApiResponse)
      setRetrieving(true)
    } catch (error) {
      setActionState({ status: 'error', message: error.message })
    }
  }

  async function submitArticleUrl(event) {
    event.preventDefault()
    setManualResult(null)
    setActionState({ status: 'loading', message: 'Checking the official article URL...' })
    try {
      const result = await fetch(`${API_BASE_URL}/api/admin/news/submit-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sourceId: manualSourceId, url: manualUrl.trim(), title: manualTitle.trim() || null,
          publishedAt: manualDate ? new Date(`${manualDate}T00:00:00+08:00`).toISOString() : null }),
      }).then(readApiResponse)
      setManualResult(result)
      await loadDashboard()
      setActionState({ status: result.failed ? 'error' : 'success', message: result.retrieved
        ? 'Complete article added to Pending Review.' : result.incomplete
          ? 'Metadata-only article added to Pending Review; full text is unavailable.' : result.duplicates
            ? 'This article is already in the review database.' : 'No article was added. See retrieval details below.' })
    } catch (error) { setActionState({ status: 'error', message: error.message }) }
  }

  async function saveEdits() {
    if (!selected) return
    setActionState({ status: 'loading', message: 'Saving review edits...' })
    try {
      const updated = await fetch(`${API_BASE_URL}/api/admin/news/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...draft, keyPoints: (draft.keyPointsText || '').split('\n').map(point => point.trim()).filter(Boolean) }),
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

  async function runBulkAction(path) {
    if (busy) return
    const { eligible, skipped } = planBulkNewsAction(items, selectedIds, path)
    if (!eligible.length) return
    const action = bulkActions.find(item => item.path === path)
    setActionState({ status: 'loading', message: `${action.progress} ${eligible.length} articles...` })
    setBulkProgress({ path, label: action.progress, processed: 0, total: eligible.length })
    const failures = []
    let completed = 0
    await runConcurrentNewsActions(eligible, item =>
        fetch(`${API_BASE_URL}/api/admin/news/${item.id}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' },
          body: path === 'reject' ? JSON.stringify({ reason: 'Rejected by admin.' }) : undefined,
        }).then(readApiResponse), ({ item, value, error, processed }) => {
      if (error) {
        failures.push(`${truncate(item.originalTitle || item.headline, 60)}: ${error.message}`)
      } else {
        if (item.id === selectedId) setSelected(value)
        completed += 1
      }
      setBulkProgress({ path, label: action.progress, processed, total: eligible.length })
    })
    // These run once, after every selected article has been processed.
    setSelectedIds([])
    await loadDashboard()
    setBulkProgress(null)
    const result = `${completed} article${completed === 1 ? '' : 's'} ${action.past}.${skipped ? ` ${skipped} skipped because they are not eligible for this action.` : ''}`
    setActionState(failures.length
      ? { status: 'error', message: `${result} ${failures.length} failed. ${failures.join(' ')}` }
      : { status: 'success', message: result })
  }

  if (!isAdmin) {
    return (
      <section className="adminNewsShell">
        <div className="adminNewsNotice error">Admin access is required for news verification.</div>
      </section>
    )
  }

  const summaryTiles = [
    { label: 'Pending Review', value: summary.pendingReview ?? 0, tone: 'pending', Icon: FileTextIcon },
    { label: 'Published Articles', value: summary.publishedArticles ?? 0, tone: 'published', Icon: ShieldCheckIcon },
    { label: 'Rejected Articles', value: summary.rejectedArticles ?? 0, tone: 'rejected', Icon: CircleXIcon },
  ]

  return (
    <section className="adminNewsShell" aria-busy={busy || retrieving}>
      <header className="adminHero">
        <div className="adminHeroText">
          <span className="adminHeroKicker">Administrator dashboard</span>
          <h1>News Review</h1>
          <p>Fetch recent articles from approved government sources. New articles enter Pending Review; nothing is published until an admin approves and publishes it.</p>
        </div>
        <button className={`adminBtn adminBtnGold${retrieving ? ' isBusy' : ''}`} disabled={busy || retrieving} type="button" onClick={fetchLatest}>
          <span className={retrieving ? 'adminSpin' : undefined}><RefreshCwIcon size={17} /></span>
          <span>{retrieving ? 'Fetching…' : 'Fetch Latest News'}</span>
        </button>
      </header>

      <section className="adminSummaryGrid" aria-label="News review summary">
        {summaryTiles.map(({ label, value, tone, Icon }) => (
          <article className={`adminStat ${tone}`} key={label}>
            <span className="adminStatIcon"><Icon size={20} /></span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </article>
        ))}
      </section>

      {fetchResult?.sources?.length > 0 && <section className="adminReviewPanel" aria-label="Retrieval results by source">
        <h2>Latest fetch by source</h2>
        <ul className="adminResultList">{fetchResult.sources.map(source => <li key={source.source}>
          <strong>{source.source}</strong>: {source.retrieved} complete new, {source.incomplete} incomplete new, {source.irrelevant || 0} outside news focus, {source.duplicates} duplicates, {source.blocked} access-denied requests, {source.notRetried} not retried, {source.failed} failed, {Math.max(0, source.skipped - source.duplicates)} older skipped.
          {source.error && <p className="adminNote" role="status">{source.error}</p>}
          {source.issues?.length > 0 && <details><summary>URLs and retrieval stages ({source.issues.length})</summary><ul>{source.issues.map((issue, index) =>
            <li key={`${issue.url}-${index}`}><strong>{issue.stage} · {issue.outcome}</strong>: {issue.url} — {issue.detail}</li>)}</ul></details>}
        </li>)}</ul>
      </section>}

      <section className="adminReviewPanel" aria-label="Submit official article URL">
        <h2>Submit an article URL</h2>
        <p>Use a URL from an active approved government source. If its page blocks extraction, a title you provide can be saved as incomplete metadata for review.</p>
        <form className="adminUrlForm" onSubmit={submitArticleUrl}>
          <label>Government source <select required value={manualSourceId} onChange={event => setManualSourceId(event.target.value)}>
            {manualSources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select></label>
          <label>Official article URL <input required type="url" value={manualUrl} onChange={event => setManualUrl(event.target.value)} placeholder="https://..." /></label>
          <label>Article title, if known <input value={manualTitle} onChange={event => setManualTitle(event.target.value)} /></label>
          <label>Publication date, if known <input type="date" value={manualDate} onChange={event => setManualDate(event.target.value)} /></label>
          <button className="adminBtn adminBtnPrimary" disabled={busy || !manualSourceId} type="submit">Check and add to review</button>
        </form>
        {manualResult && <p className="adminNote" role="status">{manualResult.retrieved} complete, {manualResult.incomplete} incomplete, {manualResult.irrelevant || 0} outside news focus, {manualResult.duplicates} duplicate, {manualResult.blocked} access-denied requests, {manualResult.notRetried} not retried, {manualResult.failed} failed.</p>}
        {manualResult?.issues?.map((issue, index) => <p className="adminNote" key={index}>{issue.stage} · {issue.outcome}: {issue.url} — {issue.detail}</p>)}
      </section>

      <SourceManager token={token} refreshSignal={sourceRefresh} />

      <div className="adminNewsFilters">
        <label htmlFor="admin-news-status">Article status
          <select id="admin-news-status" disabled={busy} value={status} onChange={event => {
            setStatus(event.target.value); setPage(0); setSelectedIds([])
          }}>
            {statuses.map(item => <option value={item} key={item}>{item === 'ALL' ? 'All statuses' : displayStatus(item)}</option>)}
          </select>
        </label>
        <p>Filter by status, then select articles on this page. Approve requires Pending Review and a summary; incomplete articles cannot be approved or published.</p>
      </div>

      {(busy || retrieving) && <div className="adminNewsLoading" role="status" aria-live="polite">
        <span className="adminLoadingSpinner" aria-hidden="true" />
        <span>{bulkProgress ? `${bulkProgress.label} articles: ${bulkProgress.processed} of ${bulkProgress.total}`
          : retrieving ? 'Fetching government articles...'
            : actionState.status === 'loading' ? actionState.message : 'Loading news...'}</span>
      </div>}

      {state.status === 'error' && state.message && <div className={`adminNewsNotice ${state.status}`}>{state.message}</div>}
      {actionState.message && actionState.status !== 'loading' && <div className={`adminNewsNotice ${actionState.status}`}>{actionState.message}</div>}

      <section className="adminArticleTableWrap" aria-label="Administrative article queue">
        {state.status === 'loading' && <PageSkeleton variant="admin" />}
        {items.length === 0 && state.status !== 'loading' && (
          <div className="adminEmpty">
            <FileTextIcon size={24} />
            <span>No articles in this queue.</span>
          </div>
        )}
        {items.length > 0 && (
          <>
            <div className="adminBulkToolbar" aria-label="Bulk review actions">
              <label className="adminSelectAll">
                <input
                  type="checkbox"
                  checked={items.every(item => selectedIds.includes(item.id))}
                  onChange={(event) => setSelectedIds(event.target.checked ? items.map((item) => item.id) : [])}
                  disabled={busy}
                />
                Select all on page
              </label>
              <span>{selectedIds.length} selected</span>
              {bulkActions.map(action => <button key={action.path} className={`adminBtn adminBtnSm adminBtn${action.tone}`}
                disabled={busy || !bulkPlans[action.path].eligible.length} type="button" onClick={() => runBulkAction(action.path)}>
                {bulkProgress?.path === action.path && <span className="adminLoadingSpinner" aria-hidden="true" />}
                {action.label} ({bulkPlans[action.path].eligible.length})
              </button>)}
              <span className="adminBulkHint">Counts show eligible selected articles.</span>
            </div>
            <table className="adminArticleTable">
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Review</th>
                  <th>Batch select</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className={item.id === selectedId ? 'selected' : ''} key={item.id}>
                    <td className="adminHeadlineCell">{truncate(item.originalTitle || item.headline)}</td>
                    <td>{item.sourceName || 'Government source'}</td>
                    <td>{formatDate(item.originalPublishedAt)}</td>
                    <td><span className={`statusPill ${item.aiProcessingStatus === 'INCOMPLETE' ? 'pending' : statusTone(item.status)}`}>{item.aiProcessingStatus === 'INCOMPLETE' ? 'Incomplete · pending review' : displayStatus(item.status)}</span></td>
                    <td>
                      <button
                        className={`adminBtn adminBtnSm adminBtnReview${item.id === selectedId ? ' isPrimary' : ''}`}
                        type="button"
                        disabled={busy}
                        aria-pressed={item.id === selectedId}
                        onClick={() => setSelectedId(item.id)}
                      >
                        {item.id === selectedId ? 'Reviewing' : 'Review'}
                      </button>
                    </td>
                    <td className="adminArticleSelectCell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${truncate(item.originalTitle || item.headline, 60)}`}
                        checked={selectedIds.includes(item.id)}
                        onChange={(event) => setSelectedIds((current) => event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id))}
                        disabled={busy}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <nav className="adminPager" aria-label="Review queue pages">
        <PaginationMini disabled={busy} page={page + 1} totalPages={totalPages} onChange={nextPage => { setSelectedIds([]); setPage(nextPage - 1) }} />
      </nav>

      <section className="adminReviewPanel" aria-label="Article review">
        {!selected && <div className="adminEmpty">Select an article to review.</div>}
        {selected && (
          <>
            <div className="reviewMeta">
              <span className={`statusPill ${statusTone(selected.status)}`}>{displayStatus(selected.status)}</span>
              <span>AI: {selected.aiProcessingStatus || 'Not processed'}</span>
              {isMockOutput && <span className="mockPill">Mock-generated</span>}
              {isDeterministic && <span className="mockPill">Deterministic source excerpt · no AI</span>}
              {isIncomplete && <span className="mockPill">Incomplete metadata · full text unavailable</span>}
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
                <p>{selected.originalContent || 'Full article text was not retrieved. This record cannot be approved or published until independently verified.'}</p>
                <h3>Extracted evidence</h3>
                <ul>{selected.extraction?.evidenceExcerpts?.map((text, index) => <li key={index}>{text}</li>)}</ul>
                <h3>Uncertainty flags</h3>
                <ul>{selected.extraction?.uncertaintyFlags?.map((text, index) => <li key={index}>{text}</li>)}</ul>
                <h3>Legislative records</h3>
                {selected.extraction?.legislativeRecords?.map((record, index) => <p key={index}>
                  <strong>{record.identifier}: {record.title}</strong> — {record.status}<br />{record.evidenceExcerpt}
                </p>)}
              </section>

              <section className="reviewForm">
                <p className="panelKicker">Review draft {isDeterministic ? '(source excerpt, no AI)' : ''}</p>
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
                <label>Key points (one per line)
                  <textarea rows={4} value={draft.keyPointsText || ''} onChange={event => setDraft(current => ({ ...current, keyPointsText: event.target.value }))} />
                </label>
                <label>Related politicians
                  <select multiple value={draft.relatedPoliticianIds || []} onChange={event => setDraft(current => ({ ...current, relatedPoliticianIds: Array.from(event.target.selectedOptions, option => option.value) }))}>
                    {politicians.map(p => <option key={p.politicianId} value={p.politicianId}>{p.fullName}</option>)}
                  </select>
                </label>
              </section>
            </div>

            <footer className="reviewActions">
              <button className="adminBtn adminBtnSave" disabled={busy} type="button" onClick={saveEdits}>Save Edits</button>
              <button className="adminBtn adminBtnAi" disabled={busy || dirty || !canProcessAi(selected)} type="button" onClick={() => runAction('process-ai', { loading: 'Processing article with AI...', success: 'Processing finished. Check its status and review the draft before approval.' })}>Process with AI</button>
              <button className="adminBtn adminBtnApprove" disabled={busy || dirty || isIncomplete || selected.status !== 'PENDING_REVIEW'} type="button" onClick={() => runAction('approve', { success: 'Article approved. Publish separately when ready.' })}>Approve</button>
              <button className="adminBtn adminBtnPublish" disabled={busy || dirty || isIncomplete || !['APPROVED', 'UNPUBLISHED'].includes(selected.status)} type="button" onClick={() => runAction('publish', { success: 'Article published.' })}>Publish</button>
              <button className="adminBtn adminBtnUnpublish" disabled={busy || selected.status !== 'PUBLISHED'} type="button" onClick={() => runAction('unpublish', { success: 'Article unpublished.' })}>Unpublish</button>
              <button className="adminBtn adminBtnReject" disabled={busy || !canRejectArticle(selected)} type="button" onClick={() => runAction('reject', { body: { reason: draft.reviewNotes || 'Rejected by admin.' }, success: 'Article rejected.' })}>Reject</button>
            </footer>

            {selectedIndex >= 0 && <p className="adminMeta">Article {selectedIndex + 1} of {items.length}</p>}
          </>
        )}
      </section>
    </section>
  )
}
