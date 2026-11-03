import { useCallback, useEffect, useRef, useState } from 'react'
import { congressRecordsPath, congressRequest } from '../../api/congress'
import CongressRecord from '../../components/governance/CongressRecord'
import { InlineSkeleton, PageSkeleton } from '../pageHelpers'
import '../AdminNews/AdminNews.css'
import './OpenCongress.css'

const normalizedName = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export default function OpenCongress({ token, politicians = [] }) {
  const [config, setConfig] = useState(null)
  const [commit, setCommit] = useState('')
  const [congress, setCongress] = useState('20')
  const [job, setJob] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [scope, setScope] = useState(null)
  const [kind, setKind] = useState('PERSON')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState([])
  const [record, setRecord] = useState(null)
  const [linkId, setLinkId] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [allowUpdates, setAllowUpdates] = useState(false)
  const [busy, setBusy] = useState(false)
  const [listState, setListState] = useState({ loading: false, error: '' })
  const [detailLoading, setDetailLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [view, setView] = useState('review')
  const [candidates, setCandidates] = useState([])
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkPreviewState, setBulkPreviewState] = useState({ loading: false, error: '' })
  const [bulkLinkState, setBulkLinkState] = useState({ loading: false, error: '', result: null })
  const [candidateError, setCandidateError] = useState('')
  const [candidateRefresh, setCandidateRefresh] = useState(0)
  const [pendingSelection, setPendingSelection] = useState(null)
  const [changedRows, setChangedRows] = useState([])
  const [newRows, setNewRows] = useState([])
  const [changesError, setChangesError] = useState('')
  const selection = useRef(null)
  const autoChecked = useRef(false)
  const [error, setError] = useState('')
  const running = job?.state === 'RUNNING'

  const select = useCallback(async id => {
    selection.current?.abort()
    const controller = new AbortController()
    selection.current = controller
    setError(''); setLinkId(''); setRecord(null); setDetailLoading(true)
    try {
      const data = await congressRequest(`${congressRecordsPath(previewId)}/${encodeURIComponent(id)}`, token, { signal: controller.signal })
      if (!controller.signal.aborted) { setRecord(data); setDetailLoading(false) }
    } catch (e) { if (e.name !== 'AbortError') { setError(e.message); setDetailLoading(false) } }
  }, [previewId, token])

  useEffect(() => {
    const controller = new AbortController()
    congressRequest('/configuration', token, { signal: controller.signal }).then(data => {
      setConfig(data); setCommit(data.commit || ''); setJob(data.lastJob)
      if (data.lastJob?.dryRun && data.lastJob.state.startsWith('COMPLETED')) {
        const last = data.lastJob
        setCommit(last.commit); setCongress(last.congress == null ? '' : String(last.congress))
        setAllowUpdates(last.allowUpdates); setScope({ commit: last.commit, congress: last.congress == null ? '' : String(last.congress), allowUpdates: last.allowUpdates })
      }
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    if (autoChecked.current || !config?.enabled || !/^[0-9a-f]{40}$/.test(config.commit || '')) return
    autoChecked.current = true
    if (config.lastJob?.state === 'RUNNING' || (config.lastJob?.dryRun && config.lastJob.state === 'COMPLETED'
      && config.lastJob.commit === config.commit && config.lastJob.congress === 20 && !config.lastJob.allowUpdates)) return
    congressRequest('/imports', token, { method: 'POST', body: JSON.stringify({ commit: config.commit, congress: 20, dryRun: true, allowUpdates: false }) })
      .then(data => { setJob(data); setScope({ commit: config.commit, congress: '20', allowUpdates: false }) })
      .catch(e => setError(e.message))
  }, [config, token])

  useEffect(() => {
    const controller = new AbortController()
    congressRequest('/match-candidates', token, { signal: controller.signal })
      .then(data => { setCandidates(data); setCandidateError('') })
      .catch(e => { if (e.name !== 'AbortError') setCandidateError(e.message) })
    return () => controller.abort()
  }, [token, candidateRefresh])

  useEffect(() => {
    if (!job?.dryRun || job.state !== 'COMPLETED') { setChangedRows([]); setNewRows([]); return }
    const controller = new AbortController()
    Promise.all(['WOULD_UPDATE', 'WOULD_CREATE'].map(change =>
      congressRequest(`/previews/${job.id}/records?kind=ALL&change=${change}&limit=25`, token, { signal: controller.signal })))
      .then(([changes, additions]) => { setChangedRows(changes); setNewRows(additions); setChangesError('') })
      .catch(e => { if (e.name !== 'AbortError') setChangesError(e.message) })
    return () => controller.abort()
  }, [job?.id, job?.state, job?.dryRun, token])

  useEffect(() => () => selection.current?.abort(), [])

  useEffect(() => {
    if (!running) return undefined
    const controller = new AbortController()
    const timer = setInterval(() => {
      congressRequest(`/imports/${job.id}`, token, { signal: controller.signal }).then(data => {
        setJob(data)
        if (data.state.startsWith('COMPLETED')) {
          setPreviewId(data.dryRun ? data.id : null); setOffset(0); setRecord(null)
          if (data.dryRun) setView('review')
          else setCandidateRefresh(value => value + 1)
        }
      }).catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    }, 2000)
    return () => { clearInterval(timer); controller.abort() }
  }, [running, job?.id, token])

  useEffect(() => {
    if (view !== 'browse' || (!previewId && !config?.schemaReady)) return undefined
    const controller = new AbortController()
    selection.current?.abort(); setRecord(null); setDetailLoading(false); setRows([])
    setListState({ loading: true, error: '' })
    congressRequest(`${congressRecordsPath(previewId)}?kind=${kind}&search=${encodeURIComponent(search)}&limit=25&offset=${offset}`, token, { signal: controller.signal })
      .then(data => { setRows(data); setListState({ loading: false, error: '' }) })
      .catch(e => { if (e.name !== 'AbortError') setListState({ loading: false, error: e.message }) })
    return () => controller.abort()
  }, [view, previewId, config?.schemaReady, kind, search, offset, token, job?.state, refresh])

  useEffect(() => {
    if (view !== 'browse' || !pendingSelection) return
    select(pendingSelection.id)
    setLinkId(pendingSelection.politicianId)
    setPendingSelection(null)
  }, [view, pendingSelection, select])

  async function start(dryRun) {
    if (!dryRun && !window.confirm(`Import Congress ${congress || 'all'} from this preview into Supabase? ${allowUpdates ? 'Changed imported records may receive a new revision.' : 'Existing changed records will be skipped.'} Nothing will be published.`)) return
    setBusy(true); setError('')
    try {
      const data = await congressRequest('/imports', token, { method: 'POST', body: JSON.stringify({ commit, congress: congress ? Number(congress) : null, dryRun, allowUpdates, previewJobId: dryRun ? null : previewId }) })
      setJob(data)
      if (dryRun) { setScope({ commit, congress, allowUpdates }); setPreviewId(null) }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function link() {
    if (!window.confirm('Link this source person to the selected existing politician? Verify their identity first.')) return
    setBusy(true); setError('')
    try {
      await congressRequest(`/people/${record.entity_id}/link`, token, { method: 'POST', body: JSON.stringify({ politicianId: linkId, evidenceUrl, verificationNotes }) })
      await select(record.entity_id)
      setCandidateRefresh(value => value + 1)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function loadBulkPreview() {
    setBulkPreviewState({ loading: true, error: '' })
    try {
      const data = await congressRequest('/bulk-link-preview', token)
      setBulkPreview(data)
      setBulkPreviewState({ loading: false, error: '' })
    } catch (e) { setBulkPreviewState({ loading: false, error: e.message }) }
  }
  async function applyBulkLinks() {
    const ready = bulkPreview?.rows.filter(row => row.status === 'READY') || []
    if (!ready.length || !window.confirm(`Link these ${ready.length} proposed identities to existing profiles? This will update Supabase links. Legislative records will remain unpublished.`)) return
    setBulkLinkState({ loading: true, error: '', result: null })
    try {
      const result = await congressRequest('/bulk-links', token, { method: 'POST',
        body: JSON.stringify(ready.map(row => ({ politicianId: row.politicianId, personId: row.sourceId }))) })
      const preview = await congressRequest('/bulk-link-preview', token)
      setBulkPreview(preview)
      setCandidateRefresh(value => value + 1)
      setBulkLinkState({ loading: false, error: '', result })
    } catch (e) { setBulkLinkState({ loading: false, error: e.message, result: null }) }
  }
  const reviewed = job?.dryRun && job.state === 'COMPLETED' && job.comparedWithDatabase && previewId === job.id && scope?.commit === commit && scope?.congress === congress && scope?.allowUpdates === allowUpdates && (allowUpdates || !(job.counts?.WOULD_UPDATE || 0))
  const exactMatches = record?.kind === 'PERSON' ? politicians.filter(person => normalizedName(person.fullName) === normalizedName(record.title)) : []
  const exactMatchIds = new Set(exactMatches.map(person => person.politicianId))
  const selectedPolitician = politicians.find(person => person.politicianId === linkId)
  const updates = job?.dryRun ? job.counts?.WOULD_UPDATE || 0 : 0
  const creates = job?.dryRun ? job.counts?.WOULD_CREATE || 0 : 0
  return <section className="adminNewsPage congressPage">
    <header className="adminNewsHeader"><div><h1>Congress data</h1><p>Review source records, connect verified identities, and check for dataset changes.</p></div></header>
    {error && <p role="alert">{error}</p>}
    {config?.message && <p>{config.message}</p>}
    {!config && !error && <PageSkeleton variant="congress" />}
    <nav className="congressTabs" aria-label="Congress data sections">
      <button className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>Review {candidates.length ? `(${candidates.length})` : ''}</button>
      <button className={view === 'browse' ? 'active' : ''} onClick={() => { setView('browse'); setPreviewId(null) }}>Browse records</button>
      <button className={view === 'tools' ? 'active' : ''} onClick={() => setView('tools')}>Dataset tools</button>
    </nav>
    {view === 'review' && <div className="adminReviewPanel congressGuide">
      <h2>Needs your review</h2>
      <p>Source records stay separate from curated politician profiles until you confirm an identity. Matching names are suggestions, not proof.</p>
      <section aria-label="Bulk identity match dry run">
        <h3>Bulk identity match preview</h3>
        <p>Compare every existing profile with imported people. This is read-only; it does not link identities or publish records.</p>
        <button disabled={bulkPreviewState.loading} onClick={loadBulkPreview}>
          {bulkPreviewState.loading ? 'Checking profiles...' : 'Preview bulk matches'}
        </button>
        {bulkPreviewState.error && <p role="alert">{bulkPreviewState.error}</p>}
        {bulkPreview && <>
          <p>{bulkPreview.totalProfiles} profiles: {bulkPreview.ready} proposed reliable links, {bulkPreview.alreadyLinked} already linked, {bulkPreview.review} need manual review, {bulkPreview.unmatched} unmatched.</p>
          {bulkPreview.ready > 0 && <button disabled={bulkLinkState.loading || bulkPreviewState.loading} onClick={applyBulkLinks}>
            {bulkLinkState.loading ? 'Linking approved matches...' : `Link ${bulkPreview.ready} approved matches`}
          </button>}
          {bulkLinkState.error && <p role="alert">{bulkLinkState.error} Refresh the preview before retrying.</p>}
          {bulkLinkState.result && <p role="status">Linked {bulkLinkState.result.linked} profiles; {bulkLinkState.result.alreadyLinked} were already linked.</p>}
          {['READY', 'REVIEW', 'UNMATCHED', 'ALREADY_LINKED'].map(status => <details key={status} open={status === 'READY' || status === 'REVIEW'}>
            <summary>{status.replaceAll('_', ' ')} ({bulkPreview.rows.filter(row => row.status === status).length})</summary>
            {bulkPreview.rows.filter(row => row.status === status).map(row => <article className="congressCandidate" key={row.politicianId}>
              <div>
                <strong>{row.profileName}</strong> <span>({row.position})</span>
                <p>{row.sourceName ? `Imported person: ${row.sourceName}` : 'No matching imported person'}{row.sourceId ? ` [${row.sourceId}]` : ''}</p>
                {row.aliases && <p>Aliases: {row.aliases}</p>}
                {row.senateKeys && <p>Senate source keys: {row.senateKeys}</p>}
                {row.memberships && <p>Congress memberships: {row.memberships}</p>}
                {row.sourceId && <p>Resolved authored bills: {row.authoredBillCount}</p>}
                <ul>{row.evidence.map(reason => <li key={reason}>{reason}</li>)}</ul>
                {row.alternatives.length > 0 && <p>Other candidates: {row.alternatives.join('; ')}</p>}
                {row.datasetUrl && <p><a href={row.datasetUrl} target="_blank" rel="noreferrer">Imported dataset record</a></p>}
                {row.officialRosterUrl && <p><a href={row.officialRosterUrl} target="_blank" rel="noreferrer">Official Senate roster for verification</a></p>}
              </div>
            </article>)}
          </details>)}
        </>}
      </section>
      {candidateError && <p role="alert">Could not load suggested matches: {candidateError} <button onClick={() => setCandidateRefresh(value => value + 1)}>Retry</button></p>}
      {!candidateError && candidates.length === 0 && <p>No exact-name matches are waiting for review. You can still search all source people under Browse records.</p>}
      {candidates.map(candidate => <div className="congressCandidate" key={candidate.sourceId}>
        <div><strong>{candidate.sourceName}</strong><p>Possible match: {candidate.politicianName} · {candidate.position || 'Office unknown'} · {candidate.jurisdiction || 'Jurisdiction unknown'} · term {candidate.termStart} to {candidate.termEnd}</p></div>
        <button onClick={() => { setView('browse'); setPreviewId(null); setKind('PERSON'); setSearch(candidate.sourceName); setOffset(0); setPendingSelection({ id: candidate.sourceId, politicianId: candidate.politicianId }) }}>Review and link</button>
      </div>)}
      <h3>Dataset changes</h3>
      {job?.dryRun && job.state === 'RUNNING' && <p role="status">Checking the dataset against imported records… {job.counts?.PROCESSED || 0} of {job.counts?.TOTAL || '?'} processed.</p>}
      {job?.dryRun && job.state.startsWith('COMPLETED') && <p>{updates} changed records and {creates} new records in the latest preview. {updates || creates ? 'Review the preview under Dataset tools before importing.' : 'No new or changed records found.'}</p>}
      {changesError && <p role="alert">Could not load changed records: {changesError}</p>}
      {changedRows.map(row => <div className="congressCandidate" key={row.id}>
        <div><strong>{row.title || row.id}</strong><p>{row.kind} · changed source record</p></div>
        <button onClick={() => { setView('browse'); setPreviewId(job.id); setKind(row.kind); setSearch(row.title || ''); setOffset(0); setPendingSelection({ id: row.id, politicianId: '' }) }}>Review change</button>
      </div>)}
      {updates > changedRows.length && <p>Showing the first {changedRows.length} of {updates} changed records. Use Browse preview records to inspect others.</p>}
      {newRows.map(row => <div className="congressCandidate" key={row.id}>
        <div><strong>{row.title || row.id}</strong><p>{row.kind} · new source record</p></div>
        <button onClick={() => { setView('browse'); setPreviewId(job.id); setKind(row.kind); setSearch(row.title || ''); setOffset(0); setPendingSelection({ id: row.id, politicianId: '' }) }}>Review new record</button>
      </div>)}
      {creates > newRows.length && <p>Showing the first {newRows.length} of {creates} new records. Use Browse preview records to inspect others.</p>}
      {!job?.dryRun && <p>The latest local source snapshot is checked when this page opens. Use the button to check again.</p>}
      <button disabled={busy || running || !config?.enabled || !/^[0-9a-f]{40}$/.test(commit)} onClick={() => start(true)}>Check for source changes</button>
      <p className="congressHelp">Checking does not change the database. New source commits must first be fetched into the configured dataset checkout.</p>
    </div>}
    {view === 'tools' && <div className="adminReviewPanel congressGuide">
      <h2>Dataset tools</h2>
      <p>Preview a specific Git snapshot before importing. Imports are an administrator operation and never publish records.</p>
      {config && !config.schemaReady && <p className="congressNotice">The Congress database schema is unavailable. Source-only previews are still possible.</p>}
      <label>Dataset commit<input value={commit} onChange={e => setCommit(e.target.value)} maxLength={40} disabled={running} /></label>
      <label>Congress (blank for all)<input type="number" min="1" max="100" value={congress} onChange={e => setCongress(e.target.value)} disabled={running} /></label>
      <label className="congressCheckbox"><input type="checkbox" checked={allowUpdates} onChange={e => setAllowUpdates(e.target.checked)} disabled={running} /> Allow new revisions of changed source records</label>
      <div className="congressActions">
        <button disabled={busy || running || !config?.enabled || !/^[0-9a-f]{40}$/.test(commit)} onClick={() => start(true)}>Preview dataset</button>
        <button disabled={busy || running || !config?.schemaReady || !config?.importEnabled || !reviewed} onClick={() => start(false)}>Import reviewed dataset</button>
        {job?.dryRun && job.state.startsWith('COMPLETED') && <button onClick={() => { setPreviewId(job.id); setView('browse'); setOffset(0) }}>Browse preview records</button>}
      </div>
      {job?.dryRun && job.counts?.WOULD_UPDATE > 0 && !allowUpdates && <p>Changed records need review. To import revised source data, enable new revisions and run a fresh preview.</p>}
      {config && !config.importEnabled && <p>Database imports are currently disabled. You can still review existing records and run previews.</p>}
      {job && <><p role="status">{job.dryRun ? 'Preview' : 'Import'}: {job.state}</p><p>{job.comparedWithDatabase ? 'Compared against existing imported revisions.' : 'Source-only preview; database duplicate checks require V25.'}</p>
        <dl className="congressCounts">{Object.entries(job.counts).map(([key, count]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{count}</dd></div>)}</dl>
        {job.issues.length > 0 && <details><summary>Issues (up to 100 shown)</summary><ul>{job.issues.map((issue, index) => <li key={index}>{issue.path}: {issue.reason}</li>)}</ul></details>}</>}
    </div>}
    {view === 'browse' && <>
    <h2>{previewId ? 'Preview records' : 'Imported records'}</h2>
    <p>{previewId ? 'These records are from a preview and have not been imported.' : 'These are imported source records for administrator review. They are not automatically public.'}</p>
    <div className="congressActions"><label>Record type<select value={kind} onChange={e => { setKind(e.target.value); setOffset(0) }}>{['PERSON', 'BILL', 'CONGRESS', 'CHAMBER', 'COMMITTEE'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Search names or titles<input value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} /></label></div>
    <ul>{rows.map(row => <li key={row.id}><button onClick={() => select(row.id)}>{row.title || row.id}</button>{row.billNumber && ` · ${row.subtype} ${row.billNumber} · Congress ${row.congress}`}</li>)}</ul>
    {listState.loading && <PageSkeleton variant="records" />}
    {listState.error && <p role="alert">{listState.error} <button onClick={() => setRefresh(value => value + 1)}>Retry records</button></p>}
    {!listState.loading && !listState.error && rows.length === 0 && <p>No records to display. Run a preview or select imported records after an approved import.</p>}
    <div className="congressActions"><button disabled={!offset || listState.loading} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous</button><button disabled={rows.length < 25 || listState.loading} onClick={() => setOffset(value => value + 25)}>Next</button></div>
    {detailLoading && <InlineSkeleton />}
    {record && <CongressRecord key={`${previewId}:${record.entity_id}`} record={record} token={token} previewId={previewId} onSelect={select}>
      {!previewId && record.kind === 'PERSON' && <div className="congressActions">{record.politicianId ? <p>Linked to politician profile: {record.politicianId}</p> : <><label>Verified existing politician<select value={linkId} onChange={e => setLinkId(e.target.value)}><option value="">Select a matching profile</option>{exactMatches.length > 0 && <optgroup label="Exact name matches">{exactMatches.map(person => <option key={person.politicianId} value={person.politicianId}>{person.fullName}</option>)}</optgroup>}<optgroup label="Other profiles">{politicians.filter(person => !exactMatchIds.has(person.politicianId)).map(person => <option key={person.politicianId} value={person.politicianId}>{person.fullName}</option>)}</optgroup></select></label>{selectedPolitician && <p>Curated profile: {selectedPolitician.fullName} · {selectedPolitician.position || 'Office unknown'} · {selectedPolitician.jurisdiction || 'Jurisdiction unknown'} · term {selectedPolitician.termStart || 'unknown'} to {selectedPolitician.termEnd || 'unknown'}. Compare this with the source memberships above before linking.</p>}<label>Official identity evidence URL<input type="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} /></label><label>Verification notes<textarea value={verificationNotes} onChange={e => setVerificationNotes(e.target.value)} /></label><button disabled={!linkId || !evidenceUrl || verificationNotes.trim().length < 20 || busy} onClick={link}>Link verified identity</button><p>If no profile exists, create a verified politician in the Politicians page first. Missing personal details must be verified.</p></>}</div>}
    </CongressRecord>}
    </>}
  </section>
}
