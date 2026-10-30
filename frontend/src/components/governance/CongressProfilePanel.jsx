import { useEffect, useRef, useState } from 'react'
import { congressRequest } from '../../api/congress'
import CongressRecord from './CongressRecord'
import '../../pages/OpenCongress/OpenCongress.css'

export default function CongressProfilePanel({ politicianId, token, onDraftCreated }) {
  const [record, setRecord] = useState(null)
  const [person, setPerson] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [suggestion, setSuggestion] = useState(null)
  const [linking, setLinking] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const selection = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    selection.current?.abort()
    setLoading(true); setError(''); setPerson(null); setRecord(null); setSuggestion(null)
    congressRequest(`/politicians/${politicianId}`, token, { signal: controller.signal })
      .then(async data => {
        if (data) { setPerson(data); setRecord(data); setLoading(false); return }
        const matches = await congressRequest('/match-candidates', token, { signal: controller.signal })
        const match = matches.find(item => item.politicianId === politicianId)
        if (match) {
          const source = await congressRequest(`/records/${encodeURIComponent(match.sourceId)}`, token, { signal: controller.signal })
          setSuggestion(match); setRecord(source)
        }
        setLoading(false)
      })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => { controller.abort(); selection.current?.abort() }
  }, [politicianId, token, refresh])
  async function select(id) {
    selection.current?.abort()
    const controller = new AbortController()
    selection.current = controller
    setLoading(true); setError('')
    try {
      const data = await congressRequest(`/records/${encodeURIComponent(id)}`, token, { signal: controller.signal })
      if (!controller.signal.aborted) { setRecord(data); setLoading(false) }
    } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } }
  }
  async function linkSuggestion() {
    if (!suggestion || !window.confirm('Confirm this source person is the same politician? Review memberships and original references first.')) return
    setLinking(true); setError('')
    try {
      await congressRequest(`/people/${encodeURIComponent(suggestion.sourceId)}/link`, token,
        { method: 'POST', body: JSON.stringify({ politicianId, evidenceUrl, verificationNotes }) })
      setRefresh(value => value + 1)
    } catch (e) { setError(e.message) } finally { setLinking(false) }
  }
  async function draftBill() {
    if (!person || !record || !window.confirm('Create a private draft for this authored bill? It will require official-source verification before publication.')) return
    setDrafting(true); setError('')
    try {
      await congressRequest(`/bills/${encodeURIComponent(record.entity_id)}/timeline-draft`, token,
        { method: 'POST', body: JSON.stringify({ personId: person.entity_id }) })
      onDraftCreated?.()
    } catch (e) { setError(e.message) } finally { setDrafting(false) }
  }
  async function draftMembership(index) {
    if (!person) return
    setDrafting(true); setError('')
    try {
      await congressRequest(`/people/${encodeURIComponent(person.entity_id)}/memberships/${index}/timeline-draft`, token,
        { method: 'POST' })
      onDraftCreated?.()
    } catch (e) { setError(e.message) } finally { setDrafting(false) }
  }
  const canDraft = Boolean(person && record?.kind === 'BILL' && record?.source_urls?.length
    && record?.relationships?.some(row => row.relationship === 'AUTHORED_BY' && row.target_id === person.entity_id))
  return <section className="congressProfilePanel"><h2>Congress source records · admin review</h2>
    {loading && <p role="status">Loading linked Congress records...</p>}
    {error && <p role="alert">{error} <button onClick={() => setRefresh(value => value + 1)}>Retry linked records</button></p>}
    {!loading && !record && !error && <p>No imported identity linked or exact-name suggestion found. Search people in Congress Data.</p>}
    {suggestion && <div className="congressNotice"><p>Possible source match. Compare its memberships and references before connecting it.</p><p>{suggestion.politicianName} · {suggestion.position || 'Office unknown'} · {suggestion.jurisdiction || 'Jurisdiction unknown'} · term {suggestion.termStart} to {suggestion.termEnd}</p><label>Official identity evidence URL<input type="url" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} /></label><label>Verification notes<textarea value={verificationNotes} onChange={event => setVerificationNotes(event.target.value)} /></label><button disabled={linking || !evidenceUrl || verificationNotes.trim().length < 20} onClick={linkSuggestion}>{linking ? 'Connecting…' : 'Confirm and connect source person'}</button></div>}
    {record && <><button disabled={loading || !person} onClick={() => { setRecord(person); setError('') }}>Back to linked person</button><CongressRecord key={record.entity_id} record={record} token={token} onSelect={select} onDraftMembership={person && record.kind === 'PERSON' ? draftMembership : undefined}>{canDraft && <button disabled={drafting} onClick={draftBill}>{drafting ? 'Creating draft…' : 'Create private bill draft for review'}</button>}</CongressRecord></>}
  </section>
}
