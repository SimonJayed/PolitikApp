import { useEffect, useState } from 'react'
import { congressRecordsPath, congressRequest, sourceHref } from '../../api/congress'
import { PaginationMini } from '../../pages/pageHelpers'

const BILL_PAGE_SIZE = 10

// Styles for this component live in OpenCongress.css (classes prefixed "cg").

function text(value, fallback = 'Not provided') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function formatDateLabel(value) {
  if (!value) return ''
  const raw = String(value).trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const date = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(raw)
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date)
}

function statusTone(status) {
  const value = String(status || '').toLowerCase()
  if (/lapsed into law|enacted|approved|signed|adopted|passed|ratified/.test(value)) return 'done'
  if (/withdrawn|vetoed|rejected|lapsed|disapproved|dropped|died/.test(value)) return 'stopped'
  if (/pending|referred|filed|reading|committee|calendar|consideration|hearing|review/.test(value)) return 'pending'
  return 'neutral'
}

function SourceLink({ url, children }) {
  const href = sourceHref(url)
  return href
    ? <a className="cgExtLink" href={href} target="_blank" rel="noopener noreferrer">{children || url} <i aria-hidden="true">↗</i></a>
    : <span className="cgMuted">Source link unavailable</span>
}

function RevisionHistory({ id, token }) {
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState({ loading: true, rows: [], error: '' })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState({ loading: true, rows: [], error: '' })
    congressRequest(`/records/${encodeURIComponent(id)}/revisions?limit=10&offset=${offset}`, token, { signal: controller.signal })
      .then(rows => setState({ loading: false, rows, error: '' }))
      .catch(error => { if (error.name !== 'AbortError') setState({ loading: false, rows: [], error: error.message }) })
    return () => controller.abort()
  }, [id, token, offset, refresh])
  return <section className="cgRevisions" aria-label="Retained source revisions">
    {state.loading && <span className="inlineSkeleton" aria-label="Loading revisions" />}
    {state.error && <div className="cgAlert" role="alert">{state.error} <button type="button" className="cgBtn cgBtnSm" onClick={() => setRefresh(value => value + 1)}>Retry revisions</button></div>}
    {!state.loading && !state.error && state.rows.length === 0 && <p className="cgMuted">No revisions found.</p>}
    {state.rows.map(row => <details className="cgDetails" key={row.revision}><summary>{row.title || id} · imported {text(row.imported_at, 'Unknown')}</summary>
      <div className="cgDetailsBody">
        <p><SourceLink url={`https://github.com/bettergovph/open-congress-data/blob/${row.dataset_commit}/${row.dataset_path}`}>Exact dataset revision</SourceLink></p>
        <p>Dataset snapshot: {text(row.snapshot_updated_at, 'Unknown')}. Source updated: {text(row.source_updated_at, 'Unknown')}.</p>
        <p>Verification notes: {(row.uncertainty_flags || []).map(flag => flag.replaceAll('_', ' ')).join('; ')}</p>
        <details className="cgDetails"><summary>Original source payload</summary><pre className="cgPre">{JSON.stringify(row.payload, null, 2)}</pre></details>
      </div>
    </details>)}
    <div className="cgMiniPager">
      <PaginationMini
        page={Math.floor(offset / 10) + 1}
        totalPages={Math.floor(offset / 10) + (state.rows.length >= 10 ? 2 : 1)}
        onChange={page => setOffset((page - 1) * 10)}
      />
    </div>
  </section>
}

export default function CongressRecord({ record, token, previewId, onSelect, onDraftMembership, children }) {
  const id = record.entity_id || record.id
  const payload = record.payload || {}
  const meta = payload.meta || {}
  const [bills, setBills] = useState([])
  const [offset, setOffset] = useState(0)
  const [billState, setBillState] = useState({ busy: false, error: '' })
  const [showRevisions, setShowRevisions] = useState(false)
  const [billRefresh, setBillRefresh] = useState(0)
  const isPerson = record.kind === 'PERSON'
  const history = Array.isArray(payload.history) ? payload.history : []
  const statuses = Array.isArray(payload.status) ? payload.status : payload.status ? [payload.status] : []
  const memberships = Array.isArray(payload.memberships) ? payload.memberships : []
  const relations = Array.isArray(record.relationships) ? record.relationships : []
  const flags = record.uncertainty_flags || record.uncertaintyFlags || []

  useEffect(() => {
    if (!isPerson) return undefined
    const controller = new AbortController()
    setBills([])
    setBillState({ busy: true, error: '' })
    congressRequest(`${congressRecordsPath(previewId)}?kind=BILL&personId=${encodeURIComponent(id)}&limit=${BILL_PAGE_SIZE}&offset=${offset}`, token, { signal: controller.signal })
      .then(data => { setBills(data); setBillState({ busy: false, error: '' }) })
      .catch(error => { if (error.name !== 'AbortError') setBillState({ busy: false, error: error.message }) })
    return () => controller.abort()
  }, [id, isPerson, offset, previewId, token, billRefresh])

  return <article className="congressRecord">
    <header className="cgRecHead">
      <span className="cgEyebrow">{previewId ? 'Dataset preview · not imported' : 'Imported source record · admin review'}</span>
      <h2>{record.title || payload.name || 'Unnamed source record'}</h2>
      <p>BetterGovPH Open Congress · {record.kind === 'BILL' ? 'Legislative proposal' : record.kind?.toLowerCase()}</p>
    </header>
    <p className="cgRecNotice">Source claims require review. A filed bill is not necessarily an enacted law. This record is not automatically public.</p>
    {children}

    {isPerson && <>
      {Array.isArray(payload.aliases) && payload.aliases.length > 0 && <p className="cgAliases">Also listed as: {payload.aliases.map(alias => text(alias)).join(', ')}</p>}
      <section className="cgRecSection">
        <h3>Congressional memberships</h3>
        {memberships.length === 0 ? <p className="cgMuted">No membership information supplied.</p> : <div className="cgTableWrap"><table>
          <thead><tr><th>Congress</th><th>Chamber</th><th>Position</th><th>Personal term dates</th>{onDraftMembership && <th>Review</th>}</tr></thead>
          <tbody>{memberships.map((membership, index) => <tr key={index}>
            <td>{text(membership.congress)}</td><td>{text(membership.subtype)}</td><td>{text(membership.position)}</td>
            <td>{text(membership.start_date, 'Unknown')} – {text(membership.end_date, 'Unknown')}</td>
            {onDraftMembership && <td><button type="button" className="cgBtn cgBtnSm" onClick={() => onDraftMembership(index)}>Create private draft</button></td>}
          </tr>)}</tbody>
        </table></div>}
        <p className="cgMuted">Membership in a Congress does not establish an individual’s exact term dates.</p>
      </section>

      <section className="cgRecSection">
        <h3>Authored bills</h3>
        {billState.busy && <span className="inlineSkeleton" aria-label="Loading authored bills" />}
        {billState.error && <div className="cgAlert" role="alert">{billState.error} <button type="button" className="cgBtn cgBtnSm" onClick={() => setBillRefresh(value => value + 1)}>Retry bills</button></div>}
        {!billState.busy && !billState.error && bills.length === 0 && <p className="cgMuted">No resolved authorship records in this {previewId ? 'preview scope' : 'import'}.</p>}
        <ul className="cgBillList">{bills.map(bill => <li key={bill.id}>
          <button type="button" className="cgBillRow" onClick={() => onSelect(bill.id)}>
            <strong>{bill.title || bill.id}</strong>
            <span>{bill.subtype?.toUpperCase()} {bill.billNumber} · Congress {bill.congress}</span>
          </button>
        </li>)}</ul>
        {(offset > 0 || bills.length >= BILL_PAGE_SIZE) && <div className="cgMiniPager">
          <PaginationMini
            page={Math.floor(offset / BILL_PAGE_SIZE) + 1}
            totalPages={Math.floor(offset / BILL_PAGE_SIZE) + (bills.length >= BILL_PAGE_SIZE ? 2 : 1)}
            onChange={page => setOffset((page - 1) * BILL_PAGE_SIZE)}
          />
        </div>}
      </section>
    </>}

    {record.kind === 'BILL' && <>
      <dl className="cgFacts">
        <div><dt>Bill</dt><dd>{text(payload.subtype)} {text(meta.bill_number)}</dd></div>
        <div><dt>Congress</dt><dd>{text(meta.congress)}</dd></div>
        <div><dt>Date filed</dt><dd>{meta.date_filed ? formatDateLabel(meta.date_filed) : 'Unknown'}</dd></div>
        <div><dt>Scope</dt><dd>{text(meta.scope)}</dd></div>
      </dl>
      {(meta.long_title || meta.congress_website_abstract) && <p className="cgAbstract">{text(meta.long_title || meta.congress_website_abstract)}</p>}

      <section className="cgRecSection">
        <h3>Reported statuses</h3>
        {statuses.length === 0 ? <p className="cgMuted">Status unknown: none supplied by the dataset.</p> : <ul className="cgTimeline">{statuses.map((entry, index) => {
          const label = typeof entry === 'string' ? entry : text(entry?.status)
          return <li key={index}>
            <span className="cgDate">{entry?.date ? formatDateLabel(entry.date) : 'Date unknown'}</span>
            <span className={`cgBadge ${statusTone(label)}`}>{label}</span>
          </li>
        })}</ul>}
      </section>

      <section className="cgRecSection">
        <h3>Authorship</h3>
        <ul className="cgPlainList">{relations.filter(row => row.relationship === 'AUTHORED_BY').map(row => <li key={row.external_key}>
          {row.target_id ? <button type="button" className="cgLinkBtn" onClick={() => onSelect(row.target_id)}>{row.target_title || row.target_id}</button> : <span>Unresolved author: {row.external_key}</span>}
          <SourceLink url={row.details?.mappingUrl}>Author mapping evidence</SourceLink>
        </li>)}</ul>
        {meta.authors_raw && <p className="cgMuted">Original author text: {text(meta.authors_raw)}</p>}
        {Array.isArray(meta.congress_website_coauthors_raw) && <details className="cgDetails"><summary>Unmatched coauthor names from the source</summary><div className="cgDetailsBody"><p>{meta.congress_website_coauthors_raw.map(value => text(value)).join('; ')}</p></div></details>}
      </section>

      <section className="cgRecSection">
        <h3>Legislative history</h3>
        {history.length === 0 ? <p className="cgMuted">No legislative history supplied.</p> : <ol className="cgTimeline cgHistoryList">{history.map((entry, index) => <li key={index}>
          <span className="cgDate">{entry?.date ? formatDateLabel(entry.date) : 'Date unknown'}</span>
          <span className="cgAction">{text(entry?.action || entry?.description)}</span>
        </li>)}</ol>}
      </section>
    </>}

    <section className="cgRecSection">
      <h3>Original references</h3>
      {(record.source_urls || []).length === 0 && <p className="cgMuted">No primary-source URL supplied. The dataset reference remains available below.</p>}
      <ul className="cgPlainList">{(record.source_urls || []).map(url => <li key={url}><SourceLink url={url} /></li>)}</ul>
      <p><SourceLink url={record.datasetUrl}>View this exact dataset file on GitHub</SourceLink></p>
      <dl className="cgFacts">
        <div><dt>Dataset snapshot date</dt><dd>{text(record.snapshot_updated_at, 'Unknown')}</dd></div>
        <div><dt>Source last updated</dt><dd>{text(record.source_updated_at, 'Unknown')}</dd></div>
        <div><dt>Imported at</dt><dd>{text(record.imported_at, 'Not imported')}</dd></div>
      </dl>
      <details className="cgDetails"><summary>Data gaps and verification notes ({flags.length})</summary><div className="cgDetailsBody"><ul>{flags.map(flag => <li key={flag}>{flag.replaceAll('_', ' ')}</li>)}</ul></div></details>
    </section>

    {!previewId && <section className="cgRecSection">
      <button type="button" className="cgBtn" aria-expanded={showRevisions} onClick={() => setShowRevisions(value => !value)}>{showRevisions ? 'Hide retained revisions' : 'Review retained revisions'}</button>
      {showRevisions && <RevisionHistory key={id} id={id} token={token} />}
    </section>}
  </article>
}