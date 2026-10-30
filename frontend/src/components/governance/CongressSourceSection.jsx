import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'

export default function CongressSourceSection({ politicianId, isAdmin, token }) {
  const [page, setPage] = useState({ records: [], total: 0, offset: 0, limit: 20 })
  const [pending, setPending] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (offset = 0) => {
    const result = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}/congress-records?offset=${offset}&limit=20`).then(readApiResponse)
    setPage(result)
  }, [politicianId])

  const loadPending = useCallback(async () => {
    if (!isAdmin || !token) return
    setPending(await congressRequest(`/politicians/${politicianId}/pending-source-updates`, token))
  }, [isAdmin, politicianId, token])

  useEffect(() => {
    setPage({ records: [], total: 0, offset: 0, limit: 20 })
    setPending([])
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
  return <section className="biographyBlock" aria-label="Congress source records">
    <h2 className="ty-section-title">Congress information</h2>
    <p>These are claims reported by the BetterGovPH Open Congress dataset. Authorship does not mean a bill became law. Dates and statuses may be incomplete; use the original links to check each record.</p>
    {error && <p role="alert">{error}</p>}
    {page.records.length === 0 && !error && <p>No linked Congress source records are available for this profile.</p>}
    {page.records.length > 0 && <>
      <p>{page.total} source record{page.total === 1 ? '' : 's'} · Showing {page.offset + 1}–{Math.min(page.offset + page.records.length, page.total)}</p>
      <ul>{page.records.map(record => <li key={record.key}>
        <strong>{record.title || 'Untitled record'}</strong> · {record.type === 'BILL' ? 'Reported authorship' : 'Reported membership'}
        <p>Congress {record.congress || 'unknown'} · {record.chamber || 'chamber unknown'}{record.filedDate ? ` · Filed ${record.filedDate}` : ''}</p>
        <p>{record.type === 'BILL' ? 'Reported status' : 'Reported position'}: {record.reportedStatus || 'Not provided'}</p>
        {Array.isArray(record.history) && record.history.length > 0 && <details><summary>Legislative history ({record.history.length})</summary>
          <ol>{record.history.map((event, index) => <li key={index}>{typeof event === 'string' ? event : `${event?.date || 'Date unknown'} · ${event?.action || event?.description || 'Action not provided'}`}</li>)}</ol>
        </details>}
        <p>{record.reviewState === 'ADMIN_REVIEWED_SOURCE' ? 'Source update reviewed by admin' : 'Source-reported information; not independently verified'}</p>
        {record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer">Original source</a>}{record.sourceUrl && record.datasetUrl && ' · '}
        {record.datasetUrl && <a href={record.datasetUrl} target="_blank" rel="noreferrer">Dataset record</a>}
      </li>)}</ul>
      <div className="paginationMini">
        <button type="button" disabled={page.offset === 0} onClick={() => load(Math.max(0, page.offset - page.limit)).catch(cause => setError(cause.message))}>Previous</button>
        <span>{Math.floor(page.offset / page.limit) + 1} / {Math.max(1, Math.ceil(page.total / page.limit))}</span>
        <button type="button" disabled={page.offset + page.limit >= page.total} onClick={() => load(page.offset + page.limit).catch(cause => setError(cause.message))}>Next</button>
      </div>
    </>}
    {isAdmin && <section aria-label="New Congress updates awaiting review">
      <h3>New source updates awaiting review ({pending.length})</h3>
      {pending.length === 0 ? <p>No new source revisions are waiting.</p> : <>
        <button type="button" onClick={() => setSelected(pending.slice(0, 100).map(row => row.key))}>Select up to 100</button>
        <button type="button" onClick={() => setSelected([])}>Clear selection</button>
        <ul>{pending.map(record => <li key={record.key}>
          <label><input type="checkbox" checked={selectedSet.has(record.key)} onChange={event => setSelected(current => event.target.checked ? [...current, record.key] : current.filter(key => key !== record.key))} /> {record.title || 'Untitled record'}</label>
          <p>{record.type} · Congress {record.congress || 'unknown'} · {record.chamber || 'unknown'}</p>
          <p>{record.type === 'BILL' ? 'Reported status' : 'Reported position'}: {record.reportedStatus || 'Not provided'}{record.filedDate ? ` · Filed ${record.filedDate}` : ''}</p>
          <p>Source revision: {record.revision}</p>
          {record.sourceUrl && <a href={record.sourceUrl} target="_blank" rel="noreferrer">Original source</a>}{record.sourceUrl && record.datasetUrl && ' · '}
          {record.datasetUrl && <a href={record.datasetUrl} target="_blank" rel="noreferrer">Dataset record</a>}
        </li>)}</ul>
        <button type="button" disabled={busy || selected.length === 0 || selected.length > 100} onClick={approveSelected}>Approve selected ({selected.length})</button>
      </>}
    </section>}
  </section>
}
