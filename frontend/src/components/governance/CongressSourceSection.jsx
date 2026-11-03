import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'

// Styles for this component live in Profile.css (classes prefixed "cs" and "pr").
const PAGE_LIMIT = 10

// ---------- Status & date parsing ----------
// Statuses can arrive as plain text, an array, or a JSON string such as
// '[{"date":"2025-08-11","status":"Pending in the Committee"}]'.
function parseDate(value) {
  if (!value) return null
  const text = String(value).trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const date = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateLabel(value) {
  const date = parseDate(value)
  if (!date) return value ? String(value) : ''
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

function normalizeStatusEntries(items) {
  return items
    .map(item => {
      if (item && typeof item === 'object') {
        return { date: item.date || item.Date || '', status: String(item.status || item.action || item.description || '').trim() }
      }
      return { date: '', status: String(item ?? '').trim() }
    })
    .filter(entry => entry.status || entry.date)
}

function parseStatusEntries(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return normalizeStatusEntries(value)
  if (typeof value === 'object') return normalizeStatusEntries([value])
  const text = String(value).trim()
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text)
      return normalizeStatusEntries(Array.isArray(parsed) ? parsed : [parsed])
    } catch { /* not JSON, fall through and show it as text */ }
  }
  return text ? [{ date: '', status: text }] : []
}

function statusTone(status) {
  const text = String(status || '').toLowerCase()
  if (/lapsed into law|enacted|approved|signed|adopted|passed|ratified/.test(text)) return 'done'
  if (/withdrawn|vetoed|rejected|lapsed|disapproved|dropped|died/.test(text)) return 'stopped'
  if (/pending|referred|filed|reading|committee|calendar|consideration|hearing|review/.test(text)) return 'pending'
  return 'neutral'
}

function StatusBlock({ label, value, filed }) {
  let entries = parseStatusEntries(value)
  if (entries.length > 1 && entries.every(entry => parseDate(entry.date))) {
    entries = [...entries].sort((left, right) => parseDate(right.date) - parseDate(left.date))
  }
  const latest = entries[0]
  return <div className="csStatusBlock">
    <span className="csStatusLabel">{label}</span>
    <div className="csStatusCurrent">
      {latest
        ? <span className={`csBadge ${statusTone(latest.status)}`}>{latest.status || 'Status not provided'}</span>
        : <span className="csBadge neutral">Not provided</span>}
      {latest?.date && <span className="csDate">{formatDateLabel(latest.date)}</span>}
      {filed && <span className="csDate">Filed {formatDateLabel(filed)}</span>}
    </div>
    {entries.length > 1 && <details className="csHistory">
      <summary>Status history ({entries.length})</summary>
      <ol className="csTimeline">{entries.map((entry, index) => <li key={index}>
        <span className="csDate">{entry.date ? formatDateLabel(entry.date) : 'Date unknown'}</span>
        <span className={`csBadge ${statusTone(entry.status)}`}>{entry.status || 'Status not provided'}</span>
      </li>)}</ol>
    </details>}
  </div>
}

function ExternalLink({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer">{children} <i className="csExt" aria-hidden="true">↗</i><span className="srOnly"> (opens in a new tab)</span></a>
}


export default function CongressSourceSection({ politicianId, isAdmin, token }) {
  const [page, setPage] = useState({ records: [], total: 0, offset: 0, limit: PAGE_LIMIT })
  const [pending, setPending] = useState([])
  const [pendingPage, setPendingPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (offset = 0) => {
    const result = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}/congress-records?offset=${offset}&limit=${PAGE_LIMIT}`).then(readApiResponse)
    setPage(result)
  }, [politicianId])

  const loadPending = useCallback(async () => {
    if (!isAdmin || !token) return
    setPending(await congressRequest(`/politicians/${politicianId}/pending-source-updates`, token))
  }, [isAdmin, politicianId, token])

  useEffect(() => {
    setPage({ records: [], total: 0, offset: 0, limit: PAGE_LIMIT })
    setPending([])
    setPendingPage(1)
    setSelected([])
    setError('')
    load(0).catch(cause => setError(cause.message))
    if (isAdmin && token) loadPending().catch(cause => setError(cause.message))
  }, [politicianId, isAdmin, token, load, loadPending])

  async function approveSelected() {
    if (!selected.length || !window.confirm(`Approve ${selected.length} source update${selected.length === 1 ? '' : 's'} for public display?`)) return
    setBusy(true)
    setError('')
    try {
      await congressRequest(`/politicians/${politicianId}/approve-source-updates`, token, {
        method: 'POST', body: JSON.stringify({ keys: selected }),
      })
      setSelected([])
      await Promise.all([load(page.offset), loadPending()])
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  const selectedSet = new Set(selected)
  const pageNumber = Math.floor(page.offset / PAGE_LIMIT) + 1
  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_LIMIT))

  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_LIMIT))
  const pendingSafePage = Math.min(pendingPage, pendingTotalPages)
  const pendingStart = (pendingSafePage - 1) * PAGE_LIMIT
  const pendingItems = pending.slice(pendingStart, pendingStart + PAGE_LIMIT)

  return <section className="prCard csSection" aria-label="Congress source records">
    <div className="prCardHead">
      <div>
        <h2 className="prCardTitle">Congress information</h2>
        <p className="prCardHint">Claims reported by the BetterGovPH Open Congress dataset.</p>
      </div>
      {page.total > 0 && <span className="prCount">{page.total}</span>}
    </div>
    <p className="csDisclaimer">Authorship does not mean a bill became law. Dates and statuses may be incomplete; use the original links to check each record.</p>
    {error && <p className="csAlert" role="alert">{error}</p>}
    {page.records.length === 0 && !error && <p className="csEmpty">No linked Congress source records are available for this profile.</p>}

    {page.records.length > 0 && <>
      <ul className="csList">{page.records.map(record => <li className="csRecord" key={record.key}>
        <div className="csRecordHead">
          <strong className="csTitle">{record.title || 'Untitled record'}</strong>
          <span className={`csType ${record.type === 'BILL' ? 'bill' : 'member'}`}>{record.type === 'BILL' ? 'Reported authorship' : 'Reported membership'}</span>
        </div>
        <p className="csMeta">Congress {record.congress || 'unknown'} · {record.chamber || 'chamber unknown'}{record.filedDate ? ` · Filed ${formatDateLabel(record.filedDate)}` : ''}</p>
        <StatusBlock label={record.type === 'BILL' ? 'Reported status' : 'Reported position'} value={record.reportedStatus} />
        {Array.isArray(record.history) && record.history.length > 0 && <details className="csHistory"><summary>Legislative history ({record.history.length})</summary>
          <ol className="csTimeline">{record.history.map((event, index) => <li key={index}>{typeof event === 'string' ? <span>{event}</span> : <><span className="csDate">{event?.date ? formatDateLabel(event.date) : 'Date unknown'}</span><span>{event?.action || event?.description || 'Action not provided'}</span></>}</li>)}</ol>
        </details>}
        <p className={`csReview${record.reviewState === 'ADMIN_REVIEWED_SOURCE' ? ' reviewed' : ''}`}>{record.reviewState === 'ADMIN_REVIEWED_SOURCE' ? 'Source update reviewed by admin' : 'Source-reported information; not independently verified'}</p>
        {(record.sourceUrl || record.datasetUrl) && <div className="csLinks">
          {record.sourceUrl && <ExternalLink href={record.sourceUrl}>Original source</ExternalLink>}
          {record.datasetUrl && <ExternalLink href={record.datasetUrl}>Dataset record</ExternalLink>}
        </div>}
      </li>)}</ul>

      <nav className="prPager" aria-label="Congress record pagination">
        <p>Showing <strong>{page.offset + 1}–{Math.min(page.offset + page.records.length, page.total)}</strong> of <strong>{page.total}</strong></p>
        {totalPages > 1 && <div className="prPagerControls">
          <button className="prPagerBtn secondary" type="button" disabled={page.offset === 0} onClick={() => load(Math.max(0, page.offset - PAGE_LIMIT)).catch(cause => setError(cause.message))}>← Previous</button>
          <span>Page {pageNumber} of {totalPages}</span>
          <button className="prPagerBtn primary" type="button" disabled={page.offset + PAGE_LIMIT >= page.total} onClick={() => load(page.offset + PAGE_LIMIT).catch(cause => setError(cause.message))}>Next →</button>
        </div>}
      </nav>
    </>}

    {isAdmin && <section className="csPending" aria-label="New Congress updates awaiting review">
      <div className="prCardHead">
        <div>
          <h3 className="csSubTitle">New source updates awaiting review</h3>
          <p className="prCardHint">Select updates to approve them for public display.</p>
        </div>
        <span className="prCount">{pending.length}</span>
      </div>
      {pending.length === 0 ? <p className="csEmpty">No new source revisions are waiting.</p> : <>
        <div className="csToolbar">
          <button className="prBtn prBtnOutline" type="button" onClick={() => setSelected(pending.slice(0, 100).map(row => row.key))}>Select up to 100</button>
          <button className="prBtn prBtnOutline" type="button" onClick={() => setSelected([])}>Clear selection</button>
          <span className="csSelectedCount">{selected.length} selected</span>
        </div>

        <ul className="csList">{pendingItems.map(record => <li className={`csRecord${selectedSet.has(record.key) ? ' selected' : ''}`} key={record.key}>
          <label className="csCheck"><input type="checkbox" checked={selectedSet.has(record.key)} onChange={event => setSelected(current => event.target.checked ? [...current, record.key] : current.filter(key => key !== record.key))} /> <strong className="csTitle">{record.title || 'Untitled record'}</strong></label>
          <p className="csMeta">{record.type} · Congress {record.congress || 'unknown'} · {record.chamber || 'unknown'}</p>
          <StatusBlock label={record.type === 'BILL' ? 'Reported status' : 'Reported position'} value={record.reportedStatus} filed={record.filedDate} />
          <p className="csMeta">Source revision: {record.revision}</p>
          {(record.sourceUrl || record.datasetUrl) && <div className="csLinks">
            {record.sourceUrl && <ExternalLink href={record.sourceUrl}>Original source</ExternalLink>}
            {record.datasetUrl && <ExternalLink href={record.datasetUrl}>Dataset record</ExternalLink>}
          </div>}
        </li>)}</ul>

        <nav className="prPager" aria-label="Pending update pagination">
          <p>Showing <strong>{pendingStart + 1}–{Math.min(pendingStart + PAGE_LIMIT, pending.length)}</strong> of <strong>{pending.length}</strong></p>
          {pendingTotalPages > 1 && <div className="prPagerControls">
            <button className="prPagerBtn secondary" type="button" disabled={pendingSafePage <= 1} onClick={() => setPendingPage(pendingSafePage - 1)}>← Previous</button>
            <span>Page {pendingSafePage} of {pendingTotalPages}</span>
            <button className="prPagerBtn primary" type="button" disabled={pendingSafePage >= pendingTotalPages} onClick={() => setPendingPage(pendingSafePage + 1)}>Next →</button>
          </div>}
        </nav>

        <div className="csApprove">
          <button className="prBtn prBtnPrimaryDark" type="button" disabled={busy || selected.length === 0 || selected.length > 100} onClick={approveSelected}>Approve selected ({selected.length})</button>
        </div>
      </>}
    </section>}
  </section>
}