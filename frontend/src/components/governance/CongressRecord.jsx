import { useEffect, useState } from 'react'
import { congressRecordsPath, congressRequest, sourceHref } from '../../api/congress'

function text(value, fallback = 'Not provided') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function SourceLink({ url, children }) {
  const href = sourceHref(url)
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children || url}</a> : <span>Source link unavailable</span>
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
  return <section aria-label="Retained source revisions">
    {state.loading && <span className="inlineSkeleton" aria-label="Loading revisions" />}
    {state.error && <p role="alert">{state.error} <button onClick={() => setRefresh(value => value + 1)}>Retry revisions</button></p>}
    {!state.loading && !state.error && state.rows.length === 0 && <p>No revisions found.</p>}
    {state.rows.map(row => <details key={row.revision}><summary>{row.title || id} · imported {text(row.imported_at, 'Unknown')}</summary>
      <p><SourceLink url={`https://github.com/bettergovph/open-congress-data/blob/${row.dataset_commit}/${row.dataset_path}`}>Exact dataset revision</SourceLink></p>
      <p>Dataset snapshot: {text(row.snapshot_updated_at, 'Unknown')}. Source updated: {text(row.source_updated_at, 'Unknown')}.</p>
      <p>Verification notes: {(row.uncertainty_flags || []).map(flag => flag.replaceAll('_', ' ')).join('; ')}</p>
      <details><summary>Original source payload</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(row.payload, null, 2)}</pre></details>
    </details>)}
    <div className="congressActions">
      <button disabled={!offset || state.loading} onClick={() => setOffset(value => Math.max(0, value - 10))}>Previous revisions</button>
      <button disabled={state.rows.length < 10 || state.loading} onClick={() => setOffset(value => value + 10)}>Next revisions</button>
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
    congressRequest(`${congressRecordsPath(previewId)}?kind=BILL&personId=${encodeURIComponent(id)}&limit=25&offset=${offset}`, token, { signal: controller.signal })
      .then(data => { setBills(data); setBillState({ busy: false, error: '' }) })
      .catch(error => { if (error.name !== 'AbortError') setBillState({ busy: false, error: error.message }) })
    return () => controller.abort()
  }, [id, isPerson, offset, previewId, token, billRefresh])

  return <article className="congressRecord">
    <p className="eyebrow">{previewId ? 'Dataset preview · not imported' : 'Imported source record · admin review'}</p>
    <h2>{record.title || payload.name || 'Unnamed source record'}</h2>
    <p>BetterGovPH Open Congress · {record.kind === 'BILL' ? 'Legislative proposal' : record.kind?.toLowerCase()}</p>
    <p className="congressNotice">Source claims require review. A filed bill is not necessarily an enacted law. This record is not automatically public.</p>
    {children}

    {isPerson && <>
      {Array.isArray(payload.aliases) && payload.aliases.length > 0 && <p>Also listed as: {payload.aliases.map(alias => text(alias)).join(', ')}</p>}
      <h3>Congressional memberships</h3>
      {memberships.length === 0 ? <p>No membership information supplied.</p> : <div className="congressTableWrap"><table>
        <thead><tr><th>Congress</th><th>Chamber</th><th>Position</th><th>Personal term dates</th>{onDraftMembership && <th>Review</th>}</tr></thead>
        <tbody>{memberships.map((membership, index) => <tr key={index}>
          <td>{text(membership.congress)}</td><td>{text(membership.subtype)}</td><td>{text(membership.position)}</td>
          <td>{text(membership.start_date, 'Unknown')} – {text(membership.end_date, 'Unknown')}</td>
          {onDraftMembership && <td><button type="button" onClick={() => onDraftMembership(index)}>Create private draft</button></td>}
        </tr>)}</tbody>
      </table></div>}
      <p>Membership in a Congress does not establish an individual’s exact term dates.</p>
      <h3>Authored bills</h3>
      {billState.busy && <span className="inlineSkeleton" aria-label="Loading authored bills" />}
      {billState.error && <p role="alert">{billState.error} <button onClick={() => setBillRefresh(value => value + 1)}>Retry bills</button></p>}
      {!billState.busy && !billState.error && bills.length === 0 && <p>No resolved authorship records in this {previewId ? 'preview scope' : 'import'}.</p>}
      <ul>{bills.map(bill => <li key={bill.id}><button type="button" onClick={() => onSelect(bill.id)}>{bill.title || bill.id}</button> · {bill.subtype?.toUpperCase()} {bill.billNumber} · Congress {bill.congress}</li>)}</ul>
      <div className="congressActions">
        <button type="button" disabled={offset === 0 || billState.busy} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous bills</button>
        <button type="button" disabled={bills.length < 25 || billState.busy} onClick={() => setOffset(value => value + 25)}>Next bills</button>
      </div>
    </>}

    {record.kind === 'BILL' && <>
      <dl className="congressFacts">
        <div><dt>Bill</dt><dd>{text(payload.subtype)} {text(meta.bill_number)}</dd></div>
        <div><dt>Congress</dt><dd>{text(meta.congress)}</dd></div>
        <div><dt>Date filed</dt><dd>{text(meta.date_filed, 'Unknown')}</dd></div>
        <div><dt>Scope</dt><dd>{text(meta.scope)}</dd></div>
      </dl>
      {(meta.long_title || meta.congress_website_abstract) && <p>{text(meta.long_title || meta.congress_website_abstract)}</p>}
      <h3>Reported statuses</h3>
      {statuses.length === 0 ? <p>Status unknown: none supplied by the dataset.</p> : <ul>{statuses.map((entry, index) => <li key={index}>
        {typeof entry === 'string' ? entry : text(entry?.status)} {entry?.date && <span>({text(entry?.date)})</span>}
      </li>)}</ul>}
      <h3>Authorship</h3>
      <ul>{relations.filter(row => row.relationship === 'AUTHORED_BY').map(row => <li key={row.external_key}>
        {row.target_id ? <button type="button" onClick={() => onSelect(row.target_id)}>{row.target_title || row.target_id}</button> : <span>Unresolved author: {row.external_key}</span>}
        {' · '}<SourceLink url={row.details?.mappingUrl}>Author mapping evidence</SourceLink>
      </li>)}</ul>
      {meta.authors_raw && <p>Original author text: {text(meta.authors_raw)}</p>}
      {Array.isArray(meta.congress_website_coauthors_raw) && <details><summary>Unmatched coauthor names from the source</summary><p>{meta.congress_website_coauthors_raw.map(value => text(value)).join('; ')}</p></details>}
      <h3>Legislative history</h3>
      {history.length === 0 ? <p>No legislative history supplied.</p> : <ol className="congressHistory">{history.map((entry, index) => <li key={index}>
        <strong>{text(entry?.date, 'Date unknown')}</strong><p>{text(entry?.action || entry?.description)}</p>
      </li>)}</ol>}
    </>}

    <h3>Original references</h3>
    {(record.source_urls || []).length === 0 && <p>No primary-source URL supplied. The dataset reference remains available below.</p>}
    <ul>{(record.source_urls || []).map(url => <li key={url}><SourceLink url={url} /></li>)}</ul>
    <p><SourceLink url={record.datasetUrl}>View this exact dataset file on GitHub</SourceLink></p>
    <dl className="congressFacts">
      <div><dt>Dataset snapshot date</dt><dd>{text(record.snapshot_updated_at, 'Unknown')}</dd></div>
      <div><dt>Source last updated</dt><dd>{text(record.source_updated_at, 'Unknown')}</dd></div>
      <div><dt>Imported at</dt><dd>{text(record.imported_at, 'Not imported')}</dd></div>
    </dl>
    <details><summary>Data gaps and verification notes ({flags.length})</summary><ul>{flags.map(flag => <li key={flag}>{flag.replaceAll('_', ' ')}</li>)}</ul></details>
    {!previewId && <><button aria-expanded={showRevisions} onClick={() => setShowRevisions(value => !value)}>{showRevisions ? 'Hide retained revisions' : 'Review retained revisions'}</button>
      {showRevisions && <RevisionHistory key={id} id={id} token={token} />}</>}
  </article>
}
