import { useEffect, useState } from 'react'
import { BarChart3Icon, FolderIcon } from '../../components/icons/Lucide'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { KpiGrid, PageSectionLoader, ProfileSkeleton, StatusLine, TimelineLedger } from '../pageHelpers'
import PoliticianEditor from '../../components/governance/PoliticianEditor'
import EditSubmissionForm from '../../components/governance/EditSubmissionForm'
import CongressProfilePanel from '../../components/governance/CongressProfilePanel'
import CongressSourceSection from '../../components/governance/CongressSourceSection'
import BaseModal from '../../components/BaseModal'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'

function exportLedger(entries, profile, type) {
  const data = type === 'json' ? JSON.stringify({ metadata: { politicianId: profile.politicianId, fullName: profile.fullName, exportedAt: new Date().toISOString() }, timelineEntries: entries }, null, 2) : [['Date', 'Category', 'Action Type', 'Summary', 'Source Citation', 'Status'], ...entries.map((entry) => [entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : '', entry.categoryTag || '', entry.actionIdentifier || '', entry.summary || entry.impactSummary || '', entry.sourceUrl || '', entry.status || 'PUBLISHED'])].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = `${(profile.fullName || 'politician').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_records.${type === 'json' ? 'json' : 'csv'}`; link.click(); URL.revokeObjectURL(url)
}


export default function PoliticianProfilePage({ dbUser, onAddContribution, onModalOpenChange, onPoliticianUpdate, onReload, politicianId, politicians, state, token }) {
  const fallback = politicians.find(p => p.politicianId === politicianId)
  const profile = state.data || fallback
  const entries = state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || []
  const verifiedEntries = entries.filter(entry => entry.actionDetails?.sourceReported !== true)
  const relatedNews = state.data?.relatedNews || []
  const [recordQuery, setRecordQuery] = useState('')
  const [recordType, setRecordType] = useState('ALL')
  const visibleEntries = verifiedEntries.filter(entry => {
    const legislative = ['BILL', 'MEMBERSHIP'].includes(entry.actionDetails?.recordType) || Boolean(entry.actionDetails?.openCongressId)
    if (recordType === 'LEGISLATION' && !legislative) return false
    if (recordType === 'OTHER' && legislative) return false
    const query = recordQuery.trim().toLowerCase()
    return !query || [entry.summary, entry.actionDetails?.legislationTitle, entry.actionDetails?.verifiedStatus]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
  const [editing, setEditing] = useState(false)
  const [record, setRecord] = useState(null)
  const [recordState, setRecordState] = useState({ status: 'idle', message: '' })
  const [congressDrafts, setCongressDrafts] = useState([])
  const [draftReview, setDraftReview] = useState(null)
  const isAdmin = dbUser?.role === 'ADMIN'
  const [archived, setArchived] = useState(false)
  useEffect(() => { setArchived(false); setCongressDrafts([]); setDraftReview(null) }, [politicianId])
  useEffect(() => {
    if (!isAdmin || !politicianId || !token) return undefined
    const controller = new AbortController()
    congressRequest(`/politicians/${politicianId}/drafts`, token, { signal: controller.signal })
      .then(setCongressDrafts)
      .catch(error => { if (error.name !== 'AbortError') setRecordState({ status: 'error', message: error.message }) })
    return () => controller.abort()
  }, [isAdmin, politicianId, token])
  async function loadCongressDrafts() {
    if (isAdmin && politicianId) setCongressDrafts(await congressRequest(`/politicians/${politicianId}/drafts`, token))
  }
  useEffect(() => {
    onModalOpenChange?.(editing || Boolean(record))
    return () => onModalOpenChange?.(false)
  }, [editing, record, onModalOpenChange])

  async function saveRecord(event) {
    event.preventDefault()
    setRecordState({ status: 'loading', message: 'Saving verified record...' })
    try {
      if (record.actionDetails?.openCongressId) {
        await congressRequest(`/records/${record.timelineId}/verification`, token, { method: 'PUT',
          body: JSON.stringify({ sourceUrl: record.sourceUrl, verificationNotes: record.verificationNotes,
            verifiedStatus: record.actionDetails.verifiedStatus, summary: record.impactSummary }) })
      } else {
        const details = Object.fromEntries(Object.entries(record.actionDetails || {}).map(([key, value]) => [key,
          ['flaggedAmount', 'allocationAmount', 'completionPercentage'].includes(key) ? Number(value) : value]))
        await fetch(`${API_BASE_URL}/api/admin/curation/metrics/${record.timelineId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...record, actionDetails: details, primarySourceUrl: record.sourceUrl }),
        }).then(readApiResponse)
      }
      setRecord(null)
      setRecordState({ status: 'success', message: 'Record updated.' })
      onReload(politicianId)
      await loadCongressDrafts()
    } catch (error) { setRecordState({ status: 'error', message: error.message }) }
  }

  async function publishCongressDraft() {
    if (!draftReview || !window.confirm('Publish this verified legislative record to the public politician profile?')) return
    setRecordState({ status: 'loading', message: 'Publishing reviewed legislative record...' })
    try {
      await congressRequest(`/drafts/${draftReview.timelineId}/publish`, token, { method: 'POST',
        body: JSON.stringify({ sourceUrl: draftReview.sourceUrl, verificationNotes: draftReview.verificationNotes,
          verifiedStatus: draftReview.verifiedStatus, summary: draftReview.summary }) })
      setDraftReview(null)
      await loadCongressDrafts()
      await onReload(politicianId)
      setRecordState({ status: 'success', message: 'Verified legislative record published.' })
    } catch (error) { setRecordState({ status: 'error', message: error.message }) }
  }

  async function hideRecord(entry) {
    if (!window.confirm('Remove this record from the public profile? Its history will be preserved.')) return
    setRecordState({ status: 'loading', message: 'Removing record...' })
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/curation/metrics/${entry.timelineId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) await readApiResponse(response)
      setRecordState({ status: 'success', message: 'Record removed from public view.' })
      onReload(politicianId)
    } catch (error) { setRecordState({ status: 'error', message: error.message }) }
  }

  async function archiveProfile() {
    if (!window.confirm('Archive this politician profile? Existing records will be preserved.')) return
    setRecordState({ status: 'loading', message: 'Archiving profile...' })
    try {
      const response = await fetch(`${API_BASE_URL}/api/politicians/${politicianId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) await readApiResponse(response)
      onPoliticianUpdate(politicianId, { status: 'ARCHIVED' })
      setArchived(true)
    } catch (error) { setRecordState({ status: 'error', message: error.message }) }
  }

  if (archived) return <section className="workspace"><p>Profile archived. Existing records have been preserved.</p></section>
  if (!politicianId) return <section className="workspace"><p>Select a politician first.</p></section>
  return <section className="workspace">
    <StatusLine state={state} />
    {state.status === 'loading' && <PageSectionLoader />}
    {state.status === 'loading' && !profile && <ProfileSkeleton />}
    {profile && <>
      <section className="profileSummary">
        <p className="eyebrow ty-page-kicker">{formatPosition(profile.position) || 'UNKNOWN'}</p>
        <h2 className="ty-section-title">{profile.fullName}</h2>
        <p>{formatJurisdiction(profile.jurisdiction) || 'Unspecified jurisdiction'}</p>
        <p>{profile.partyAffiliation || 'Party affiliation unavailable'}</p>
        <p>Term: {profile.termStart || 'Start date unverified'} to {profile.termEnd || 'End date unverified'}.</p>
        {profile.termEnd && profile.termEnd < new Date().toISOString().slice(0, 10) && <p>This term has ended; current office information may be outdated.</p>}
      </section>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {isAdmin && <><button onClick={() => setEditing(true)}>Edit Profile</button>
          <button onClick={() => onAddContribution(politicianId)}>Add verified record</button>
          <button disabled={recordState.status === 'loading'} onClick={archiveProfile}>Archive profile</button></>}
        <button onClick={() => exportLedger(entries, profile, 'csv')}><BarChart3Icon size={16} /> Export CSV</button>
        <button onClick={() => exportLedger(entries, profile, 'json')}><FolderIcon size={16} /> Export JSON</button>
      </div>
      <KpiGrid profile={profile} />
      <section className="biographyBlock"><h2 className="ty-section-title">Biography</h2><p>{profile.biography || 'No biography available.'}</p></section>
      <CongressSourceSection key={politicianId} politicianId={politicianId} isAdmin={isAdmin} token={token} />
      <StatusLine state={recordState} />
      {isAdmin && <CongressProfilePanel key={politicianId} politicianId={politicianId} token={token} onDraftCreated={loadCongressDrafts} />}
      {isAdmin && <section className="biographyBlock" aria-label="Congress drafts pending verification">
        <h2 className="ty-section-title">Congress records awaiting verification ({congressDrafts.length})</h2>
        {congressDrafts.length === 0 && <p>No linked drafts. Open a membership or authored bill in the Congress source panel to create one.</p>}
        {congressDrafts.map(draft => <div key={draft.timelineId}>
          <p><strong>{draft.actionDetails?.recordType === 'MEMBERSHIP' ? `Congress ${draft.actionDetails.congress || 'Unknown'} membership` : draft.actionDetails?.legislationTitle || 'Untitled bill'}</strong> · Private draft</p>
          <p>{draft.summary}</p>
          <button onClick={() => setDraftReview({ timelineId: draft.timelineId, sourceUrl: draft.sourceUrl || '',
            verificationNotes: '', verifiedStatus: '', summary: draft.summary })}>Review and verify</button>
        </div>)}
        {draftReview && <div className="congressNotice">
          <h3>Verify the original Congress record and status</h3>
          <label>Public summary<textarea value={draftReview.summary} onChange={event => setDraftReview(current => ({ ...current, summary: event.target.value }))} /></label>
          <label>Official source URL<input type="url" value={draftReview.sourceUrl} onChange={event => setDraftReview(current => ({ ...current, sourceUrl: event.target.value }))} /></label>
          <label>Verified status<input value={draftReview.verifiedStatus} onChange={event => setDraftReview(current => ({ ...current, verifiedStatus: event.target.value }))} placeholder="Filed, referred, enacted, or unknown" /></label>
          <label>Evidence and review notes<textarea value={draftReview.verificationNotes} onChange={event => setDraftReview(current => ({ ...current, verificationNotes: event.target.value }))} /></label>
          <button disabled={recordState.status === 'loading' || !draftReview.summary.trim() || !draftReview.sourceUrl || !draftReview.verifiedStatus || draftReview.verificationNotes.trim().length < 20} onClick={publishCongressDraft}>Publish verified record</button>
          <button onClick={() => setDraftReview(null)}>Cancel</button>
        </div>}
      </section>}
      <section aria-label="Filter verified records">
        <label>Search verified records <input value={recordQuery} onChange={event => setRecordQuery(event.target.value)} placeholder="Bill title, status, or activity" /></label>
        <label>Record type <select value={recordType} onChange={event => setRecordType(event.target.value)}>
          <option value="ALL">All records</option><option value="LEGISLATION">Legislation</option><option value="OTHER">Other activities</option>
        </select></label>
      </section>
      <TimelineLedger entries={visibleEntries} isLoading={state.status === 'loading'} allowChallenge={false} title="Verified public records" />
      <section className="biographyBlock" aria-label="Related published news">
        <h2 className="ty-section-title">Related government news</h2>
        {relatedNews.length === 0 ? <p>No reviewed news articles are linked to this politician.</p> : <ul>{relatedNews.map(item =>
          <li key={item.id}><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.headline}</a>
            <p>{item.sourceName} · {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-PH') : 'Date unavailable'}</p>
            <p>{item.summary}</p></li>)}</ul>}
      </section>
      {isAdmin && verifiedEntries.length > 0 && <details><summary>Manage published records</summary>
        {verifiedEntries.map(entry => <div key={entry.timelineId}><p>{entry.summary}</p>
          <button disabled={recordState.status === 'loading'} onClick={() => { setRecord({ ...entry, impactSummary: entry.summary }); setRecordState({ status: 'idle', message: '' }) }}>Edit record</button>
          <button disabled={recordState.status === 'loading'} onClick={() => hideRecord(entry)}>Remove record</button>
        </div>)}
      </details>}
      {isAdmin && editing && <PoliticianEditor politician={{ ...fallback, ...profile, politicianId }} token={token} onClose={() => setEditing(false)}
        onSaved={saved => { onPoliticianUpdate(politicianId, saved); onReload(politicianId) }} />}
      {isAdmin && record && <BaseModal isOpen title="Edit verified record" onClose={() => setRecord(null)} isDismissDisabled={recordState.status === 'loading'}>
        {record.actionDetails?.openCongressId ? <form className="editorPanel" onSubmit={saveRecord}>
          <p>Update the verified claim using its official record. Imported source details remain attached.</p>
          <label>Public summary<textarea required value={record.impactSummary || ''} onChange={event => setRecord(current => ({ ...current, impactSummary: event.target.value }))} /></label>
          <label>Official source URL<input required type="url" value={record.sourceUrl || ''} onChange={event => setRecord(current => ({ ...current, sourceUrl: event.target.value }))} /></label>
          <label>Verified status<input required value={record.actionDetails?.verifiedStatus || ''} onChange={event => setRecord(current => ({ ...current, actionDetails: { ...current.actionDetails, verifiedStatus: event.target.value } }))} /></label>
          <label>Evidence and review notes<textarea required minLength={20} value={record.verificationNotes || ''} onChange={event => setRecord(current => ({ ...current, verificationNotes: event.target.value }))} /></label>
          <button disabled={recordState.status === 'loading'} type="submit">Save verified record</button>
          <StatusLine state={recordState} />
        </form> : <EditSubmissionForm formData={record} politicians={politicians} selectedPoliticianId={politicianId} state={recordState}
          onChange={event => setRecord(current => ({ ...current, [event.target.name]: event.target.value }))}
          onDetailChange={(key, value) => setRecord(current => ({ ...current, actionDetails: { ...current.actionDetails, [key]: value } }))}
          onDomainCheck={() => {}} onSubmit={saveRecord} />}
        <button disabled={recordState.status === 'loading'} onClick={() => setRecord(null)}>Cancel</button>
      </BaseModal>}
    </>}
  </section>
}
