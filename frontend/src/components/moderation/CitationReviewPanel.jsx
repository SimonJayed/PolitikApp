import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { sourceHref } from '../../api/congress'
import { REVIEW_STATUS_LABELS } from '../../features/verification/citationReviews'
import './CitationReviewPanel.css'

const ENDPOINT = `${API_BASE_URL}/api/admin/citation-reviews`
const PAGE_SIZE = 30
const types = { PROFILE: 'Profile', TIMELINE: 'Timeline record', SUBMISSION: 'Submission', ACCOMPLISHMENT: 'Accomplishment' }

export default function CitationReviewPanel({ token }) {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('NEEDS_REVIEW')
  const [missingSource, setMissingSource] = useState(false)
  const [recordId, setRecordId] = useState('')
  const [idInput, setIdInput] = useState('')
  const [offset, setOffset] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE_SIZE), needsReview: String(status === 'NEEDS_REVIEW') })
    if (type) params.set('type', type)
    if (status && status !== 'NEEDS_REVIEW') params.set('status', status)
    if (missingSource) params.set('missingSource', 'true')
    if (recordId) params.set('recordId', recordId)
    fetch(`${ENDPOINT}?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(readApiResponse)
      .then(result => {
        if (!controller.signal.aborted) {
          if (!result.records.length && offset > 0) setOffset(current => Math.max(0, current - PAGE_SIZE))
          else setPage(result)
        }
      })
      .catch(problem => { if (!controller.signal.aborted) setError(problem.message) })
    return () => controller.abort()
  }, [token, type, status, missingSource, recordId, offset, refresh])

  function changeList() {
    setPage(null)
    setError('')
  }

  function openReview(record) {
    setMessage('')
    setFormError('')
    setDraft({ ...record, sourceUrl: record.sourceUrl || sourceHref(record.originalSourceUrl) || '',
      sourceOrganization: record.sourceOrganization || '', verificationNotes: record.verificationNotes || '',
      attribution: record.attribution || '' })
  }

  function filterById(event) {
    event.preventDefault()
    const id = idInput.trim()
    if (id === recordId && offset === 0) return
    changeList()
    setDraft(null)
    setOffset(0)
    setRecordId(id)
  }

  function field(name, value) {
    setDraft(current => ({ ...current, [name]: value }))
  }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setFormError('')
    setSaving(true)
    try {
      const { type: recordType, id, status: reviewStatus, sourceUrl, sourceOrganization, verificationNotes,
        attribution, recordUpdatedAt, reviewedAt } = draft
      await fetch(`${ENDPOINT}/${recordType}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: reviewStatus, sourceUrl, sourceOrganization, verificationNotes,
          attribution: attribution || null, recordUpdatedAt, reviewedAt }),
      }).then(readApiResponse)
      setDraft(null)
      setMessage('Citation review saved.')
      changeList()
      setRefresh(value => value + 1)
    } catch (problem) {
      setFormError(problem.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="citationReview" aria-label="Citation verification">
    <div className="citationReviewFilters">
      <label>Record type<select value={type} onChange={event => { changeList(); setDraft(null); setType(event.target.value); setOffset(0) }} disabled={saving}>
        <option value="">All record types</option>
        {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Verification status<select value={status} onChange={event => { changeList(); setDraft(null); setStatus(event.target.value); setOffset(0) }} disabled={saving}>
        <option value="NEEDS_REVIEW">Needs review</option>
        <option value="">All statuses</option>
        {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label><input type="checkbox" checked={missingSource} disabled={saving}
        onChange={event => { changeList(); setDraft(null); setMissingSource(event.target.checked); setOffset(0) }} /> Missing citation</label>
      <form onSubmit={filterById}>
        <label>Record ID<input value={idInput} onChange={event => setIdInput(event.target.value)}
          pattern="[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}"
          title="Enter a record UUID or leave blank" disabled={saving} /></label>
        <button type="submit" disabled={saving}>Apply ID filter</button>
      </form>
    </div>

    {draft && <form className="citationReviewForm" onSubmit={save}>
      <h3>{draft.title}</h3>
      <p>{draft.publicationStatus}</p>
      {draft.description && <p>{draft.description}</p>}
      {draft.facts && <details><summary>Recorded fields</summary><pre>{draft.facts}</pre></details>}
      {draft.originalSourceUrl && <p>Original citation · {draft.originalSourceUrl}</p>}
      <label>Review status<select value={draft.status} onChange={event => field('status', event.target.value)}>
        {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Supporting source URL<input type="url" maxLength={2048} value={draft.sourceUrl} onChange={event => field('sourceUrl', event.target.value)} required={draft.status === 'VERIFIED'} /></label>
      <label>Source organization<input maxLength={200} value={draft.sourceOrganization} onChange={event => field('sourceOrganization', event.target.value)} required={draft.status === 'VERIFIED'} /></label>
      {(draft.title === 'COA_FINDING' || draft.attribution) && <label>Attribution<select value={draft.attribution} onChange={event => field('attribution', event.target.value)}>
        <option value="">Select attribution</option>
        <option value="DIRECT">Directly attributable</option>
        <option value="ASSOCIATED_AGENCY">Associated agency</option>
        <option value="UNCONFIRMED">Unconfirmed</option>
      </select></label>}
      <label>Verification notes<textarea maxLength={5000} value={draft.verificationNotes} onChange={event => field('verificationNotes', event.target.value)} required={draft.status === 'VERIFIED'} /></label>
      {draft.reviewedAt && <p>Last reviewed {new Date(draft.reviewedAt).toLocaleString('en-PH')}</p>}
      {formError && <p role="alert">{formError}</p>}
      <div className="citationReviewActions">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save review'}</button>
        <button type="button" disabled={saving} onClick={() => setDraft(null)}>Cancel</button>
        {formError && <button type="button" disabled={saving} onClick={() => { setDraft(null); changeList(); setRefresh(value => value + 1) }}>Reload records</button>}
      </div>
    </form>}

    {message && <p role="status">{message}</p>}
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => { changeList(); setRefresh(value => value + 1) }}>Retry</button></div>}
    {!page && !error && <p role="status">Loading citation records…</p>}
    {page?.records.length === 0 && <p>No records match these filters.</p>}
    {page?.records.length > 0 && <ul className="citationReviewList">{page.records.map(row => {
      const href = sourceHref(row.sourceUrl || row.originalSourceUrl)
      return <li key={`${row.type}:${row.id}`}>
        <div><strong>{row.title.replaceAll('_', ' ')}</strong>
          <div>{types[row.type]}{row.type !== 'PROFILE' && row.politicianName ? ` · ${row.politicianName}` : ''} · {REVIEW_STATUS_LABELS[row.status]}</div>
          {href ? <a href={href} target="_blank" rel="noreferrer">Open citation</a> : <span>Citation unavailable</span>}
        </div>
        <button type="button" onClick={() => openReview(row)} disabled={saving}>Review</button>
      </li>
    })}</ul>}
    {(offset > 0 || page?.hasMore) && <div className="citationReviewActions">
      <button type="button" disabled={saving || offset === 0} onClick={() => { changeList(); setOffset(value => value - PAGE_SIZE) }}>Previous</button>
      <button type="button" disabled={saving || !page?.hasMore} onClick={() => { changeList(); setOffset(value => value + PAGE_SIZE) }}>Next</button>
    </div>}
  </section>
}
