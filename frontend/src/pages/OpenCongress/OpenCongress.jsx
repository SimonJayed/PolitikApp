import { useCallback, useEffect, useRef, useState } from 'react'
import { congressRecordsPath, congressRequest } from '../../api/congress'
import CongressRecord from '../../components/governance/CongressRecord'
import { InlineSkeleton, PageSkeleton } from '../pageHelpers'
import './OpenCongress.css'

const normalizedName = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const PAGE_SIZE = 25
const BULK_GROUPS = [
  { status: 'READY', tone: 'ready', label: 'Ready to link' },
  { status: 'REVIEW', tone: 'review', label: 'Need manual review' },
  { status: 'UNMATCHED', tone: 'unmatched', label: 'Unmatched' },
  { status: 'ALREADY_LINKED', tone: 'linked', label: 'Already linked' },
]

function Chevron({ direction }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

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
    congressRequest(`${congressRecordsPath(previewId)}?kind=${kind}&search=${encodeURIComponent(search)}&limit=${PAGE_SIZE}&offset=${offset}`, token, { signal: controller.signal })
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
  const validCommit = /^[0-9a-f]{40}$/.test(commit)
  const jobTone = !job ? 'neutral' : job.state === 'RUNNING' ? 'pending' : job.state.startsWith('COMPLETED') ? 'done' : 'failed'

  const openBrowse = (options) => {
    setView('browse')
    setPreviewId(options.previewId ?? null)
    setKind(options.kind)
    setSearch(options.search)
    setOffset(0)
    setPendingSelection(options.selection)
  }

  return <section className="congressPage">
    <header className="cgHero">
      <div className="cgHeroText">
        <h1>Congress data</h1>
        <p>Review source records, connect verified identities, and check for dataset changes.</p>
      </div>
      <div className="cgHeroChips">
        <span className="cgChip"><strong>{candidates.length}</strong> to review</span>
        {commit && <span className="cgChip">Dataset <strong>{commit.slice(0, 7)}</strong></span>}
        {job && <span className={`cgChip cgChip-${jobTone}`}>{job.dryRun ? 'Preview' : 'Import'} · {job.state.replaceAll('_', ' ').toLowerCase()}</span>}
      </div>
    </header>

    {error && <div className="cgAlert" role="alert">{error}</div>}
    {config?.message && <div className="cgNotice">{config.message}</div>}
    {!config && !error && <PageSkeleton variant="congress" />}

    <nav className="cgTabs" aria-label="Congress data sections">
      <button type="button" className={view === 'review' ? 'active' : ''} onClick={() => setView('review')}>
        Review {candidates.length > 0 && <span className="cgTabCount">{candidates.length}</span>}
      </button>
      <button type="button" className={view === 'browse' ? 'active' : ''} onClick={() => { setView('browse'); setPreviewId(null) }}>Browse records</button>
      <button type="button" className={view === 'tools' ? 'active' : ''} onClick={() => setView('tools')}>Dataset tools</button>
    </nav>

    {view === 'review' && <div className="cgStack">
      <section className="cgCard">
        <div className="cgCardHead">
          <div>
            <h2>Needs your review</h2>
            <p className="cgHint">Source records stay separate from curated politician profiles until you confirm an identity. Matching names are suggestions, not proof.</p>
          </div>
        </div>

        <section className="cgSub" aria-label="Bulk identity match dry run">
          <div className="cgSubHead">
            <div>
              <h3>Bulk identity match preview</h3>
              <p className="cgHint">Compare every existing profile with imported people. This is read-only; it does not link identities or publish records.</p>
            </div>
            <button type="button" className="cgBtn" disabled={bulkPreviewState.loading} onClick={loadBulkPreview}>
              {bulkPreviewState.loading ? 'Checking profiles...' : 'Preview bulk matches'}
            </button>
          </div>
          {bulkPreviewState.error && <div className="cgAlert" role="alert">{bulkPreviewState.error}</div>}
          {bulkPreview && <>
            <dl className="cgStats">
              <div><dt>Profiles</dt><dd>{bulkPreview.totalProfiles}</dd></div>
              <div className="ready"><dt>Proposed reliable links</dt><dd>{bulkPreview.ready}</dd></div>
              <div className="linked"><dt>Already linked</dt><dd>{bulkPreview.alreadyLinked}</dd></div>
              <div className="review"><dt>Need manual review</dt><dd>{bulkPreview.review}</dd></div>
              <div className="unmatched"><dt>Unmatched</dt><dd>{bulkPreview.unmatched}</dd></div>
            </dl>
            {bulkPreview.ready > 0 && <div className="cgActions">
              <button type="button" className="cgBtn cgBtnPrimary" disabled={bulkLinkState.loading || bulkPreviewState.loading} onClick={applyBulkLinks}>
                {bulkLinkState.loading ? 'Linking approved matches...' : `Link ${bulkPreview.ready} approved matches`}
              </button>
            </div>}
            {bulkLinkState.error && <div className="cgAlert" role="alert">{bulkLinkState.error} Refresh the preview before retrying.</div>}
            {bulkLinkState.result && <div className="cgNotice success" role="status">Linked {bulkLinkState.result.linked} profiles; {bulkLinkState.result.alreadyLinked} were already linked.</div>}
            {BULK_GROUPS.map(({ status, tone, label }) => {
              const groupRows = bulkPreview.rows.filter(row => row.status === status)
              return <details className={`cgGroup ${tone}`} key={status} open={status === 'READY' || status === 'REVIEW'}>
                <summary><span className="cgGroupDot" aria-hidden="true" />{label}<span className="cgCount">{groupRows.length}</span></summary>
                <div className="cgGroupBody">
                  {groupRows.length === 0 && <p className="cgEmpty">Nothing in this group.</p>}
                  {groupRows.map(row => <article className="cgCandidate" key={row.politicianId}>
                    <div className="cgCandidateBody">
                      <p className="cgCandidateTitle"><strong>{row.profileName}</strong> <span>({row.position})</span></p>
                      <p>{row.sourceName ? `Imported person: ${row.sourceName}` : 'No matching imported person'}{row.sourceId ? ` [${row.sourceId}]` : ''}</p>
                      {row.aliases && <p>Aliases: {row.aliases}</p>}
                      {row.senateKeys && <p>Senate source keys: {row.senateKeys}</p>}
                      {row.memberships && <p>Congress memberships: {row.memberships}</p>}
                      {row.sourceId && <p>Resolved authored bills: {row.authoredBillCount}</p>}
                      <ul>{row.evidence.map(reason => <li key={reason}>{reason}</li>)}</ul>
                      {row.alternatives.length > 0 && <p>Other candidates: {row.alternatives.join('; ')}</p>}
                      {(row.datasetUrl || row.officialRosterUrl) && <div className="cgLinks">
                        {row.datasetUrl && <a href={row.datasetUrl} target="_blank" rel="noreferrer">Imported dataset record <i aria-hidden="true">↗</i></a>}
                        {row.officialRosterUrl && <a href={row.officialRosterUrl} target="_blank" rel="noreferrer">Official Senate roster for verification <i aria-hidden="true">↗</i></a>}
                      </div>}
                    </div>
                  </article>)}
                </div>
              </details>
            })}
          </>}
        </section>

        <section className="cgSub" aria-label="Suggested identity matches">
          <div className="cgSubHead">
            <div>
              <h3>Suggested matches</h3>
              <p className="cgHint">Exact-name matches between imported people and existing profiles.</p>
            </div>
            {candidates.length > 0 && <span className="cgCount">{candidates.length}</span>}
          </div>
          {candidateError && <div className="cgAlert" role="alert">Could not load suggested matches: {candidateError} <button type="button" className="cgBtn cgBtnSm" onClick={() => setCandidateRefresh(value => value + 1)}>Retry</button></div>}
          {!candidateError && candidates.length === 0 && <p className="cgEmpty">No exact-name matches are waiting for review. You can still search all source people under Browse records.</p>}
          <div className="cgList">
            {candidates.map(candidate => <div className="cgCandidate" key={candidate.sourceId}>
              <div className="cgCandidateBody">
                <p className="cgCandidateTitle"><strong>{candidate.sourceName}</strong></p>
                <p>Possible match: {candidate.politicianName} · {candidate.position || 'Office unknown'} · {candidate.jurisdiction || 'Jurisdiction unknown'} · term {candidate.termStart} to {candidate.termEnd}</p>
              </div>
              <button type="button" className="cgBtn cgBtnPrimary" onClick={() => openBrowse({ kind: 'PERSON', search: candidate.sourceName, selection: { id: candidate.sourceId, politicianId: candidate.politicianId } })}>Review and link</button>
            </div>)}
          </div>
        </section>

        <section className="cgSub" aria-label="Dataset changes">
          <div className="cgSubHead">
            <div>
              <h3>Dataset changes</h3>
              {job?.dryRun && job.state === 'RUNNING' && <p className="cgHint" role="status">Checking the dataset against imported records… {job.counts?.PROCESSED || 0} of {job.counts?.TOTAL || '?'} processed.</p>}
              {job?.dryRun && job.state.startsWith('COMPLETED') && <p className="cgHint">{updates} changed records and {creates} new records in the latest preview. {updates || creates ? 'Review the preview under Dataset tools before importing.' : 'No new or changed records found.'}</p>}
              {!job?.dryRun && <p className="cgHint">The latest local source snapshot is checked when this page opens. Use the button to check again.</p>}
            </div>
            <button type="button" className="cgBtn" disabled={busy || running || !config?.enabled || !validCommit} onClick={() => start(true)}>Check for source changes</button>
          </div>
          {changesError && <div className="cgAlert" role="alert">Could not load changed records: {changesError}</div>}
          <div className="cgList">
            {changedRows.map(row => <div className="cgCandidate" key={row.id}>
              <div className="cgCandidateBody">
                <p className="cgCandidateTitle"><strong>{row.title || row.id}</strong></p>
                <p><span className="cgTag changed">Changed</span> {row.kind} · changed source record</p>
              </div>
              <button type="button" className="cgBtn" onClick={() => openBrowse({ previewId: job.id, kind: row.kind, search: row.title || '', selection: { id: row.id, politicianId: '' } })}>Review change</button>
            </div>)}
          </div>
          {updates > changedRows.length && <p className="cgHint">Showing the first {changedRows.length} of {updates} changed records. Use Browse preview records to inspect others.</p>}
          <div className="cgList">
            {newRows.map(row => <div className="cgCandidate" key={row.id}>
              <div className="cgCandidateBody">
                <p className="cgCandidateTitle"><strong>{row.title || row.id}</strong></p>
                <p><span className="cgTag created">New</span> {row.kind} · new source record</p>
              </div>
              <button type="button" className="cgBtn" onClick={() => openBrowse({ previewId: job.id, kind: row.kind, search: row.title || '', selection: { id: row.id, politicianId: '' } })}>Review new record</button>
            </div>)}
          </div>
          {creates > newRows.length && <p className="cgHint">Showing the first {newRows.length} of {creates} new records. Use Browse preview records to inspect others.</p>}
          <p className="cgHint">Checking does not change the database. New source commits must first be fetched into the configured dataset checkout.</p>
        </section>
      </section>
    </div>}

    {view === 'tools' && <div className="cgStack">
      <section className="cgCard">
        <div className="cgCardHead">
          <div>
            <h2>Dataset tools</h2>
            <p className="cgHint">Preview a specific Git snapshot before importing. Imports are an administrator operation and never publish records.</p>
          </div>
        </div>
        {config && !config.schemaReady && <div className="cgNotice">The Congress database schema is unavailable. Source-only previews are still possible.</div>}

        <div className="cgForm">
          <label className="cgField cgFieldWide">Dataset commit<input value={commit} onChange={e => setCommit(e.target.value)} maxLength={40} disabled={running} /></label>
          <label className="cgField">Congress (blank for all)<input type="number" min="1" max="100" value={congress} onChange={e => setCongress(e.target.value)} disabled={running} /></label>
          <label className="cgCheckbox"><input type="checkbox" checked={allowUpdates} onChange={e => setAllowUpdates(e.target.checked)} disabled={running} /> Allow new revisions of changed source records</label>
        </div>

        <div className="cgActions">
          <button type="button" className="cgBtn" disabled={busy || running || !config?.enabled || !validCommit} onClick={() => start(true)}>Preview dataset</button>
          <button type="button" className="cgBtn cgBtnPrimary" disabled={busy || running || !config?.schemaReady || !config?.importEnabled || !reviewed} onClick={() => start(false)}>Import reviewed dataset</button>
          {job?.dryRun && job.state.startsWith('COMPLETED') && <button type="button" className="cgBtn" onClick={() => { setPreviewId(job.id); setView('browse'); setOffset(0) }}>Browse preview records</button>}
        </div>

        {job?.dryRun && job.counts?.WOULD_UPDATE > 0 && !allowUpdates && <div className="cgNotice">Changed records need review. To import revised source data, enable new revisions and run a fresh preview.</div>}
        {config && !config.importEnabled && <div className="cgNotice">Database imports are currently disabled. You can still review existing records and run previews.</div>}

        {job && <section className="cgSub">
          <div className="cgSubHead">
            <h3>Latest {job.dryRun ? 'preview' : 'import'}</h3>
            <span className={`cgChip cgChip-${jobTone} onLight`} role="status">{job.dryRun ? 'Preview' : 'Import'}: {job.state}</span>
          </div>
          <p className="cgHint">{job.comparedWithDatabase ? 'Compared against existing imported revisions.' : 'Source-only preview; database duplicate checks require V25.'}</p>
          <dl className="cgCounts">{Object.entries(job.counts).map(([key, count]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{count}</dd></div>)}</dl>
          {job.issues.length > 0 && <details className="cgIssues"><summary>Issues (up to 100 shown)</summary><ul>{job.issues.map((issue, index) => <li key={index}>{issue.path}: {issue.reason}</li>)}</ul></details>}
        </section>}
      </section>
    </div>}

    {view === 'browse' && <div className="cgStack">
      <section className="cgCard">
        <div className="cgCardHead">
          <div>
            <h2>{previewId ? 'Preview records' : 'Imported records'}</h2>
            <p className="cgHint">{previewId ? 'These records are from a preview and have not been imported.' : 'These are imported source records for administrator review. They are not automatically public.'}</p>
          </div>
        </div>
        <div className="cgToolbar">
          <label className="cgField">Record type<select value={kind} onChange={e => { setKind(e.target.value); setOffset(0) }}>{['PERSON', 'BILL', 'CONGRESS', 'CHAMBER', 'COMMITTEE'].map(value => <option key={value}>{value}</option>)}</select></label>
          <label className="cgField cgFieldWide">Search names or titles<input value={search} onChange={e => { setSearch(e.target.value); setOffset(0) }} placeholder="Type a name or bill title" /></label>
        </div>
      </section>

      <div className="cgBrowse">
        <section className="cgCard cgListPane" aria-label="Record results">
          {listState.loading && <PageSkeleton variant="records" />}
          {listState.error && <div className="cgAlert" role="alert">{listState.error} <button type="button" className="cgBtn cgBtnSm" onClick={() => setRefresh(value => value + 1)}>Retry records</button></div>}
          {!listState.loading && !listState.error && rows.length === 0 && <p className="cgEmpty">No records to display. Run a preview or select imported records after an approved import.</p>}
          <ul className="cgRows">{rows.map(row => <li key={row.id}>
            <button type="button" className={`cgRow${record?.entity_id === row.id ? ' active' : ''}`} onClick={() => select(row.id)}>
              <strong>{row.title || row.id}</strong>
              {row.billNumber && <span>{row.subtype} {row.billNumber} · Congress {row.congress}</span>}
            </button>
          </li>)}</ul>
          <nav className="cgPager" aria-label="Record pages">
            <button type="button" className="cgArrow" aria-label="Previous records" title="Previous records" disabled={!offset || listState.loading} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}><Chevron direction="left" /></button>
            <span>{rows.length > 0 ? `${offset + 1}–${offset + rows.length}` : '—'}</span>
            <button type="button" className="cgArrow" aria-label="Next records" title="Next records" disabled={rows.length < PAGE_SIZE || listState.loading} onClick={() => setOffset(value => value + PAGE_SIZE)}><Chevron direction="right" /></button>
          </nav>
        </section>

        <div className="cgDetailPane">
          {detailLoading && <InlineSkeleton />}
          {!record && !detailLoading && <div className="cgPlaceholder">Select a record from the list to see its details.</div>}
          {record && <CongressRecord key={`${previewId}:${record.entity_id}`} record={record} token={token} previewId={previewId} onSelect={select}>
            {!previewId && record.kind === 'PERSON' && <div className="cgLink">{record.politicianId ? <p className="cgLinked">Linked to politician profile: {record.politicianId}</p> : <>
              <h3>Link to a politician profile</h3>
              <label className="cgField">Verified existing politician<select value={linkId} onChange={e => setLinkId(e.target.value)}><option value="">Select a matching profile</option>{exactMatches.length > 0 && <optgroup label="Exact name matches">{exactMatches.map(person => <option key={person.politicianId} value={person.politicianId}>{person.fullName}</option>)}</optgroup>}<optgroup label="Other profiles">{politicians.filter(person => !exactMatchIds.has(person.politicianId)).map(person => <option key={person.politicianId} value={person.politicianId}>{person.fullName}</option>)}</optgroup></select></label>
              {selectedPolitician && <p className="cgNotice">Curated profile: {selectedPolitician.fullName} · {selectedPolitician.position || 'Office unknown'} · {selectedPolitician.jurisdiction || 'Jurisdiction unknown'} · term {selectedPolitician.termStart || 'unknown'} to {selectedPolitician.termEnd || 'unknown'}. Compare this with the source memberships above before linking.</p>}
              <label className="cgField">Official identity evidence URL<input type="url" value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} /></label>
              <label className="cgField">Verification notes<textarea value={verificationNotes} onChange={e => setVerificationNotes(e.target.value)} /></label>
              <div className="cgActions"><button type="button" className="cgBtn cgBtnPrimary" disabled={!linkId || !evidenceUrl || verificationNotes.trim().length < 20 || busy} onClick={link}>Link verified identity</button></div>
              <p className="cgHint">If no profile exists, create a verified politician in the Politicians page first. Missing personal details must be verified.</p>
            </>}</div>}
          </CongressRecord>}
        </div>
      </div>
    </div>}
  </section>
}