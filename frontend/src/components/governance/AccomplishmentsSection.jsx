import { useEffect, useRef, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import BaseModal from '../BaseModal'

const emptyForm = { title: '', description: '', period: 'unknown', accomplishmentDate: '', accomplishmentYear: '', category: '', sourceUrl: '', visible: true }

function periodLabel(entry) {
  if (entry.accomplishmentDate) {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' })
      .format(new Date(`${entry.accomplishmentDate}T00:00:00`))
  }
  return entry.accomplishmentYear ? String(entry.accomplishmentYear) : 'Date not provided'
}

function Citation({ url }) {
  // Only render navigable web citations, even if historical data is malformed.
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
  } catch { return null }
  return <a href={url} target="_blank" rel="noreferrer">View supporting source<span className="srOnly"> (opens in a new tab)</span></a>
}

export function PublicAccomplishments({ records = [] }) {
  const visible = records.filter(entry => entry.visible)
  return visible.length === 0
    ? <p className="prMuted">No accomplishments are currently available for this politician.</p>
    : <ul className="accomplishmentList">{visible.map(entry => <li key={entry.accomplishmentId}>
      <article>
        <h3>{entry.title}</h3>
        <p className="prMuted">{periodLabel(entry)}{entry.category ? ` · ${entry.category}` : ''}</p>
        <p className="accomplishmentDescription">{entry.description}</p>
        <Citation url={entry.sourceUrl} />
      </article>
    </li>)}</ul>
}

export default function AccomplishmentsSection({ politicianId, isAdmin, token }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [editor, setEditor] = useState(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const publicPath = `/api/politicians/${politicianId}/accomplishments`
  const adminPath = `/api/admin/politicians/${politicianId}/accomplishments`
  const canManage = Boolean(isAdmin && token)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setRecords([])
    const path = canManage ? adminPath : publicPath
    fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
      headers: canManage ? { Authorization: `Bearer ${token}` } : {},
    }).then(readApiResponse).then(rows => {
      if (!controller.signal.aborted) { setRecords(rows); setLoading(false) }
    }).catch(err => {
      if (!controller.signal.aborted) { setError(err.message); setLoading(false) }
    })
    return () => controller.abort()
  }, [publicPath, adminPath, canManage, token, refresh])

  function openEditor(entry) {
    setFormError('')
    setMessage('')
    setEditor(entry ? {
      ...entry,
      period: entry.accomplishmentDate ? 'date' : entry.accomplishmentYear ? 'year' : 'unknown',
      accomplishmentDate: entry.accomplishmentDate || '',
      accomplishmentYear: entry.accomplishmentYear || '',
      category: entry.category || '',
    } : { ...emptyForm })
  }

  async function save(event) {
    event.preventDefault()
    if (!canManage || submitting.current) return
    submitting.current = true
    setBusy(true)
    setFormError('')
    try {
      const payload = {
        title: editor.title.trim(), description: editor.description.trim(), category: editor.category.trim() || null,
        sourceUrl: editor.sourceUrl.trim(), visible: editor.visible,
        accomplishmentDate: editor.period === 'date' ? editor.accomplishmentDate : null,
        accomplishmentYear: editor.period === 'year' ? Number(editor.accomplishmentYear) : null,
      }
      if (!payload.title || !payload.description || !payload.sourceUrl) throw new Error('Title, description, and supporting source are required.')
      const saved = await fetch(`${API_BASE_URL}${adminPath}${editor.accomplishmentId ? `/${editor.accomplishmentId}` : ''}`, {
        method: editor.accomplishmentId ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(readApiResponse)
      setRecords(current => editor.accomplishmentId
        ? current.map(entry => entry.accomplishmentId === saved.accomplishmentId ? saved : entry)
        : [saved, ...current])
      setMessage(editor.accomplishmentId ? 'Accomplishment updated.' : 'Accomplishment added.')
      setEditor(null)
    } catch (err) { setFormError(err.message) }
    finally { submitting.current = false; setBusy(false) }
  }

  async function hide(entry) {
    if (!canManage || submitting.current || !window.confirm(`Hide “${entry.title}” from public display? The record will be retained.`)) return
    submitting.current = true
    setBusy(true)
    setMessage('')
    try {
      await fetch(`${API_BASE_URL}${adminPath}/${entry.accomplishmentId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      }).then(readApiResponse)
      setRecords(current => current.map(item => item.accomplishmentId === entry.accomplishmentId ? { ...item, visible: false } : item))
      setMessage('Accomplishment hidden from public display. Its information has been retained.')
    } catch (err) { setMessage(err.message) }
    finally { submitting.current = false; setBusy(false) }
  }

  return <section className="prCard accomplishmentsSection" aria-label="Accomplishments">
    <div className="prCardHead">
      <h2 className="prCardTitle">Accomplishments</h2>
      {canManage && <button className="prBtn prBtnOutline" type="button" disabled={loading || busy || Boolean(error)} onClick={() => openEditor(null)}>Add accomplishment</button>}
    </div>
    {loading ? <p className="prMuted" role="status">Loading accomplishments…</p>
      : error ? <div role="alert"><p>{error}</p><button className="prBtn prBtnOutline" type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>
        : <PublicAccomplishments records={records} />}
    {message && <p role="status">{message}</p>}
    {canManage && !loading && !error && <details className="accomplishmentManagement">
      <summary>Manage accomplishments ({records.length})</summary>
      {records.length === 0 ? <p className="prMuted">No accomplishment records yet. Add an accomplishment to get started.</p>
        : <ul className="accomplishmentList">{records.map(entry => <li key={entry.accomplishmentId}>
          <h3>{entry.title} <span className="prBadge">{entry.visible ? 'Visible' : 'Hidden'}</span></h3>
          <p className="prMuted">{periodLabel(entry)}</p>
          <p className="accomplishmentDescription">{entry.description}</p>
          <Citation url={entry.sourceUrl} />
          <div className="prManageActions">
            <button className="prBtn prBtnOutline" type="button" disabled={busy} onClick={() => openEditor(entry)}>Edit accomplishment</button>
            {entry.visible && <button className="prBtn prBtnDangerOutline" type="button" disabled={busy} onClick={() => hide(entry)}>Hide accomplishment</button>}
          </div>
        </li>)}</ul>}
    </details>}
    {canManage && editor && <BaseModal isOpen title={editor.accomplishmentId ? 'Edit accomplishment' : 'Add accomplishment'} onClose={() => setEditor(null)} isDismissDisabled={busy}>
      <div className="prModalContent">
        <h2>{editor.accomplishmentId ? 'Edit accomplishment' : 'Add accomplishment'}</h2>
        <form className="editorPanel prForm" onSubmit={save}>
          <label>Title<input required maxLength={200} value={editor.title} onChange={event => setEditor(current => ({ ...current, title: event.target.value }))} /></label>
          <label>Description<textarea required maxLength={5000} value={editor.description} onChange={event => setEditor(current => ({ ...current, description: event.target.value }))} /></label>
          <label>Date precision<select value={editor.period} onChange={event => setEditor(current => ({ ...current, period: event.target.value }))}>
            <option value="unknown">Date not provided</option><option value="date">Exact date</option><option value="year">Year only</option>
          </select></label>
          {editor.period === 'date' && <label>Accomplishment date<input required type="date" min="0001-01-01" max="9999-12-31" value={editor.accomplishmentDate} onChange={event => setEditor(current => ({ ...current, accomplishmentDate: event.target.value }))} /></label>}
          {editor.period === 'year' && <label>Accomplishment year<input required type="number" min="1" max="9999" step="1" value={editor.accomplishmentYear} onChange={event => setEditor(current => ({ ...current, accomplishmentYear: event.target.value }))} /></label>}
          <label>Category (optional)<input maxLength={100} value={editor.category} onChange={event => setEditor(current => ({ ...current, category: event.target.value }))} /></label>
          <label>Supporting source URL<input required type="url" maxLength={2048} value={editor.sourceUrl} onChange={event => setEditor(current => ({ ...current, sourceUrl: event.target.value }))} /></label>
          <p className="prMuted">Verify the accomplishment against its source before making it visible. Citations must use an approved .gov.ph or .edu.ph website.</p>
          <label>Visibility<select value={editor.visible ? 'visible' : 'hidden'} onChange={event => setEditor(current => ({ ...current, visible: event.target.value === 'visible' }))}>
            <option value="visible">Visible to public users</option><option value="hidden">Hidden from public users</option>
          </select></label>
          {formError && <p role="alert">{formError}</p>}
          <div className="prManageActions">
            <button className="prBtn prBtnPrimaryDark" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save accomplishment'}</button>
            <button className="prBtn prBtnOutline" type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </form>
      </div>
    </BaseModal>}
  </section>
}
