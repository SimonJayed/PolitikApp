import { useCallback, useEffect, useRef, useState } from 'react'
import { congressRequest, publicCongressRecords, sourceHref } from '../../api/congress'
import { PaginationMini } from '../../pages/pageHelpers'
import { groupBillsByCongress, ordinal, summarizeMemberships } from '../../features/congress/congressHistory'
import { authoredBills, billTitle, chronologicalHistory, recordDate, reportedStatuses } from '../../features/congress/legislativeRecords'

const PAGE_LIMIT = 5

function ExternalLink({ href, children }) {
  const safe = sourceHref(href)
  return safe ? <a href={safe} target="_blank" rel="noopener noreferrer">{children}<span className="srOnly"> (opens in a new tab)</span></a> : null
}

function StatusBlock({ value }) {
  let entries = reportedStatuses(value)
  if (entries.every(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.date))) entries = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const latest = entries[0]
  return <div className="csStatusBlock">
    <span className="csStatusLabel">Reported status</span>
    <p className="csMeta">{latest?.status || 'Reported status unavailable'}</p>
    {latest?.date && <p className="csMeta">Status date: {recordDate(latest.date)}</p>}
    {entries.length > 1 && <details className="csHistory"><summary>Reported status history ({entries.length})</summary>
      <ol className="csTimeline">{entries.map((entry, index) => <li key={index}>
        {entry.date && <span className="csDate">{recordDate(entry.date)}</span>}<span>{entry.status}</span>
      </li>)}</ol>
    </details>}
  </div>
}

export function LegislativeCard({ record }) {
  const history = chronologicalHistory(record.history)
  const available = record.originalSourceStatus === 'AVAILABLE' && sourceHref(record.sourceUrl)
  return <article className="csRecord">
    <h3 className="csTitle">{billTitle(record)}</h3>
    <p className="csAuthorship">Authorship: <span>Source-reported author</span></p>
    <p className="csMeta">Congress: {ordinal(record.congress) ? `${ordinal(record.congress)} Congress` : 'Congress unavailable'}</p>
    <p className="csMeta">Filed: {record.filedDate ? recordDate(record.filedDate) : 'Filing date unavailable'}</p>
    <StatusBlock value={record.reportedStatus} />
    {history.length ? <details className="csHistory"><summary>Legislative history ({history.length})</summary>
      <ol className="csTimeline">{history.map((event, index) => <li key={index}>
        {event.date && <span className="csDate">{recordDate(event.date)}</span>}<span>{event.description}</span>
      </li>)}</ol>
    </details> : <p className="csMeta">Legislative history unavailable</p>}
    <p className="csReview">Source-reported information; not independently verified.{record.reviewState === 'ADMIN_REVIEWED_SOURCE' ? ' An administrator reviewed this dataset revision for display.' : ''}</p>
    <div className="csLinks">{available
      ? <ExternalLink href={record.sourceUrl}>Original Source</ExternalLink>
      : <span className="csMeta">{record.originalSourceStatus === 'UNCHECKED' ? 'Checking original source…' : 'Original source unavailable'}</span>}
    </div>
  </article>
}

export default function CongressSourceSection({ politicianId, isAdmin, token }) {
  const [page, setPage] = useState({ records: [], memberships: [], congresses: [], total: 0, offset: 0, limit: PAGE_LIMIT })
  const [congress, setCongress] = useState('ALL')
  const [pending, setPending] = useState([])
  const [pendingPage, setPendingPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const version = useRef(0)

  const load = useCallback(async (offset = 0, refresh = false) => {
    const requestVersion = ++version.current
    setLoading(true); setError(''); setSourceError('')
    try {
      const result = await publicCongressRecords(politicianId, offset, PAGE_LIMIT, refresh, { congress })
      if (requestVersion !== version.current) return
      setPage(result); setLoading(false)
      // Availability checks run after the records render, outside the database transaction.
      if (result.records.length) {
        try {
          const checked = await publicCongressRecords(politicianId, offset, PAGE_LIMIT, refresh, { congress, checkSources: true })
          if (requestVersion === version.current) setPage(checked)
        } catch {
          if (requestVersion === version.current) {
            setPage(current => ({ ...current, records: current.records.map(row => ({ ...row, originalSourceStatus: 'UNCONFIRMED' })) }))
            setSourceError('Original source availability could not be confirmed. Stored citations are preserved.')
          }
        }
      }
    } catch (cause) { if (requestVersion === version.current) setError(cause.message) }
    finally { if (requestVersion === version.current) setLoading(false) }
  }, [politicianId, congress])

  const loadPending = useCallback(async () => {
    if (isAdmin && token) setPending(await congressRequest(`/politicians/${politicianId}/pending-source-updates`, token))
  }, [isAdmin, politicianId, token])

  useEffect(() => {
    const counter = version
    load(0)
    return () => { counter.current++ }
  }, [load])
  useEffect(() => {
    setPending([]); setPendingPage(1); setSelected([])
    loadPending().catch(cause => setError(cause.message))
  }, [loadPending])

  async function approveSelected() {
    if (!selected.length || !window.confirm(`Approve ${selected.length} source updates for public display?`)) return
    setBusy(true); setError('')
    try {
      await congressRequest(`/politicians/${politicianId}/approve-source-updates`, token, { method: 'POST', body: JSON.stringify({ keys: selected }) })
      setSelected([])
      await Promise.all([load(page.offset, true), loadPending()])
    } catch (cause) { setError(cause.message) }
    finally { setBusy(false) }
  }

  const records = authoredBills(page.records, politicianId)
  const totalPages = Math.max(1, Math.ceil(page.total / PAGE_LIMIT))
  const selectedSet = new Set(selected)
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_LIMIT))
  const pendingSafePage = Math.min(pendingPage, pendingTotalPages)
  const pendingStart = (pendingSafePage - 1) * PAGE_LIMIT
  return <section className="prCard csSection" aria-label="Legislative Records">
    <div className="prCardHead"><div>
      <h2 className="prCardTitle">Legislative Records</h2>
      <p className="prCardHint">Authored bills reported by the BetterGovPH Open Congress dataset.</p>
    </div><span className="prCount">{page.total} authored bills</span></div>
    <p className="csDisclaimer">Source-reported information; not independently verified. Authorship does not mean a bill became law. Dates and statuses may be incomplete.</p>
    {summarizeMemberships(page.memberships).length > 0 && <div className="csMembershipSummary" aria-label="Congressional memberships">
      {summarizeMemberships(page.memberships).map(history => <p className="csMeta" key={history}>{history}</p>)}
    </div>}
    <label className="prField csCongressFilter"><span>Congress</span>
      <select value={congress} onChange={event => setCongress(event.target.value)}>
        <option value="ALL">All Congresses</option>
        {(page.congresses || []).map(number => <option key={number} value={number}>{ordinal(number)} Congress</option>)}
      </select>
    </label>
    {error && <div role="alert"><p className="csAlert">{error}</p><button className="prBtn prBtnOutline" type="button" onClick={() => load(0, true)}>Retry legislative records</button></div>}
    {sourceError && <p className="csMeta" role="status">{sourceError}</p>}
    {loading ? <p role="status">Loading authored bills…</p> : <>
      {!records.length && !error && <p className="csEmpty">No source-reported authored bills are available for this selection.</p>}
      {groupBillsByCongress(records).map(([label, rows]) => <section className="csCongressGroup" key={label} aria-label={label}>
        <h3 className="csSubTitle">{label}</h3>
        <ul className="csList">{rows.map(record => <li key={record.key}><LegislativeCard record={record} /></li>)}</ul>
      </section>)}
      {page.total > 0 && <nav className="prPager" aria-label="Authored bill pagination">
        <p>Showing <strong>{records.length ? page.offset + 1 : 0}–{Math.min(page.offset + records.length, page.total)}</strong> of <strong>{page.total}</strong> authored bills</p>
        <PaginationMini page={Math.floor(page.offset / PAGE_LIMIT) + 1} totalPages={totalPages} onChange={next => load((next - 1) * PAGE_LIMIT)} />
      </nav>}
      {records.some(row => ['UNAVAILABLE', 'UNCONFIRMED'].includes(row.originalSourceStatus)) && <p className="csMeta">Original source unavailable means the stored link is invalid, missing, or could not be reached by the latest server check. This does not establish that the document no longer exists. No replacement URL is inferred.</p>}
    </>}

    {isAdmin && <section className="csPending" aria-label="New Congress updates awaiting review">
      <div className="prCardHead"><h3 className="csSubTitle">New source updates awaiting review</h3><span className="prCount">{pending.length}</span></div>
      <p className="prCardHint">Administrator source-review tools. These updates remain separate from independently verified accountability records.</p>
      {pending.length === 0 ? <p className="csEmpty">No new source revisions are waiting.</p> : <>
        <div className="csToolbar">
          <button className="prBtn prBtnOutline" type="button" onClick={() => setSelected(pending.slice(0, 100).map(row => row.key))}>Select up to 100</button>
          <button className="prBtn prBtnOutline" type="button" onClick={() => setSelected([])}>Clear selection</button><span>{selected.length} selected</span>
        </div>
        <ul className="csList">{pending.slice(pendingStart, pendingStart + PAGE_LIMIT).map(record => <li className="csRecord" key={record.key}>
          <label className="csCheck"><input type="checkbox" checked={selectedSet.has(record.key)} onChange={event => setSelected(current => event.target.checked ? [...current, record.key] : current.filter(key => key !== record.key))} /><strong className="csTitle">{record.title || 'Untitled source record'}</strong></label>
          <p className="csMeta">{record.type} · Congress {record.congress || 'unknown'} · {record.chamber || 'unknown'}</p>
          {record.type === 'BILL' && <StatusBlock value={record.reportedStatus} />}
          <p className="csMeta">Source revision: {record.revision}</p>
          <div className="csLinks">
            <ExternalLink href={record.sourceUrl}>Stored original source (admin review)</ExternalLink>
            <ExternalLink href={record.datasetUrl}>Dataset record (admin provenance)</ExternalLink>
          </div>
          {record.sourceUrl && <p className="csMeta">Availability has not been checked for this pending update.</p>}
        </li>)}</ul>
        <nav className="prPager" aria-label="Pending update pagination"><p>{pending.length} pending updates</p><PaginationMini page={pendingSafePage} totalPages={pendingTotalPages} onChange={setPendingPage} /></nav>
        <button className="prBtn prBtnPrimaryDark" type="button" disabled={busy || !selected.length || selected.length > 100} onClick={approveSelected}>Approve selected ({selected.length})</button>
      </>}
    </section>}
  </section>
}
