import { useEffect, useState } from 'react'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { isRemovedGovernmentSource } from '../../features/news/sourceReference'

const empty = { name: '', baseUrl: '', feedUrl: '', retrievalType: 'RSS', active: false }

export default function SourceManager({ token, refreshSignal }) {
  const [sources, setSources] = useState([])
  const [draft, setDraft] = useState(empty)
  const [id, setId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/admin/news/sources`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(readApiResponse).then(rows => setSources(rows.filter(source => !isRemovedGovernmentSource(source))))
      .catch(error => { if (error.name !== 'AbortError') setMessage(error.message) })
    return () => controller.abort()
  }, [token, refreshSignal])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (isRemovedGovernmentSource(draft)) throw new Error('This source has been removed from government news retrieval.')
      const source = await fetch(`${API_BASE_URL}/api/admin/news/sources${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      }).then(readApiResponse)
      setSources(current => [...current.filter(item => item.id !== source.id), source])
      setId(null)
      setDraft(empty)
      setMessage('Source saved.')
    } catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  return <details className="adminReviewPanel admSrcManager">
    <summary>Manage approved government sources <span className="admSrcCount">{sources.length}</span></summary>
    <div className="admSrcBody">
      <p className="adminNote">Manage government news sources here. Previously retrieved articles retain their original source attribution when a source is removed.</p>
      <p className="adminMeta">DBM source: https://www.dbm.gov.ph/ · RSS: https://www.dbm.gov.ph/index.php/management-2?format=feed&amp;type=rss</p>
      {message && <p className="adminNote" role="status">{message}</p>}
      <ul className="admSrcList">{sources.map(source => {
        return <li className="admSrcRow" key={source.id}>
          <div className="admSrcRowMain">
            <button className="adminBtn adminBtnSm adminBtnSecondary" type="button" disabled={busy} onClick={() => { setId(source.id); setDraft({ ...source, feedUrl: source.feedUrl || '' }) }}>{source.name}</button>
            <span className={`admSrcStatus ${source.active ? 'active' : 'inactive'}`}>{source.active ? 'Active' : 'Inactive'}</span>
            <span className="admSrcType">{source.retrievalType}</span>
          </div>
          {source.lastError && <p className="adminNote" role="status">{source.lastError}</p>}
        </li>
      })}</ul>
      <form className="reviewForm admSrcForm" onSubmit={save}>
        <h3>{id ? 'Edit source' : 'Add source'}</h3>
        <label>Name<input required maxLength={180} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Government website<input required type="url" value={draft.baseUrl} onChange={event => setDraft({ ...draft, baseUrl: event.target.value })} /></label>
        <label>Feed, API, or document URL<input type="url" value={draft.feedUrl} onChange={event => setDraft({ ...draft, feedUrl: event.target.value })} /></label>
        <label>Retrieval type<select value={draft.retrievalType} onChange={event => setDraft({ ...draft, retrievalType: event.target.value })}>
          <option value="RSS">RSS feed</option><option value="API">JSON API</option><option value="HTML">News listing or HTML document</option>
        </select></label>
        <label className="admCheckLabel"><input type="checkbox" checked={draft.active} onChange={event => setDraft({ ...draft, active: event.target.checked })} />Approve source for retrieval</label>
        <div className="admFormActions">
          <button className="adminBtn adminBtnPrimary" disabled={busy} type="submit">{busy ? 'Saving...' : 'Save source'}</button>
          {id && <button className="adminBtn adminBtnSecondary" disabled={busy} type="button" onClick={() => { setId(null); setDraft(empty) }}>Cancel edit</button>}
        </div>
      </form>
    </div>
  </details>
}
