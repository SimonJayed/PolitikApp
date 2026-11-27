import { useEffect, useRef, useState } from 'react'
import BaseModal from '../BaseModal'
import { legislativeAccountabilityPath, legislativeAccountabilityRequest } from '../../api/legislativeAccountability'
import { publicCitationHref } from '../../api/congress'
import { REVIEW_STATUS_LABELS } from '../../features/verification/citationReviews'
import './LegislativeAccountabilitySection.css'

const kinds = {
  ATTENDANCE: ['Legislative attendance', 'PRESENT', 'ABSENT', 'EXCUSED', 'UNAVAILABLE'],
  VOTE: ['Voting history', 'YES', 'NO', 'ABSTAINED', 'ABSENT', 'UNKNOWN'],
  COMMITTEE: ['Committee assignments', 'CHAIR', 'VICE_CHAIR', 'MEMBER'],
}
const labels = {
  PRESENT: 'Present', ABSENT: 'Absent', EXCUSED: 'Excused', UNAVAILABLE: 'Unavailable',
  YES: 'Yes', NO: 'No', ABSTAINED: 'Abstained', UNKNOWN: 'Unknown',
  CHAIR: 'Chairperson', VICE_CHAIR: 'Vice-chairperson', MEMBER: 'Member',
}
const chambers = { SENATE: 'Senate', HOUSE: 'House of Representatives' }
const emptyLabels = { ATTENDANCE: 'attendance records', VOTE: 'voting records', COMMITTEE: 'committee assignments' }
const limit = 20
const percent = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 })

function dateLabel(date) {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(date))
}

export function AttendanceSummaries({ summaries }) {
  if (!summaries.length) return null
  return <ul className="legAccountabilitySummaries" aria-label="Attendance coverage">
    {summaries.map(summary => <li key={`${summary.chamber}-${summary.congress}`}>
      <strong>{chambers[summary.chamber]} · Congress {summary.congress}</strong>
      <p>{summary.percentage == null ? 'Attendance percentage unavailable' : `${percent.format(summary.percentage)}% attendance in recorded sessions`}</p>
      <p className="prMuted">{summary.present} present · {summary.absent} absent · {summary.excused} excused · {summary.unavailable} unavailable</p>
    </li>)}
    <li className="prMuted">Percentages use verified present and absent sessions. Excused and unavailable sessions are excluded, and coverage may be partial.</li>
  </ul>
}

export function LegislativeAccountabilityRecord({ record }) {
  const href = record.verificationStatus === 'INVALID_SOURCE' ? null : publicCitationHref(record.sourceUrl)
  return <>
    <h3>{record.title || record.reference}</h3>
    <p className="prMuted">{chambers[record.chamber]} · Congress {record.congress}
      {record.kind === 'VOTE' && record.reference ? ` · ${record.reference}` : ''}
    </p>
    <p><strong>{labels[record.decision]}</strong>
      {record.eventDate && <> · <time dateTime={record.eventDate}>{dateLabel(record.eventDate)}</time></>}
      {record.endDate && <> · Ends <time dateTime={record.endDate}>{dateLabel(record.endDate)}</time></>}
    </p>
    <p className="prMuted">{REVIEW_STATUS_LABELS[record.verificationStatus]}
      {record.reviewedAt && <> · {record.verificationStatus === 'VERIFIED' ? 'Reviewed' : 'Status updated'} <time dateTime={record.reviewedAt}>{dateLabel(record.reviewedAt)}</time></>}
    </p>
    {href && <a href={href} target="_blank" rel="noopener noreferrer">{record.sourceOrganization || 'Official source'}</a>}
  </>
}

function RecordEditor({ editor, setEditor, busy, error, onSave, onClose }) {
  const { kind, recordId, withdrawnAt, verificationStatus } = editor
  const update = event => {
    const { name, value } = event.target
    setEditor(current => ({ ...current, [name]: value }))
  }
  const verified = verificationStatus === 'VERIFIED'
  return <BaseModal isOpen wide isDismissDisabled={busy}
    title={recordId ? 'Edit legislative record' : `Add ${kinds[kind][0].toLowerCase()} record`} onClose={onClose}>
    <form className="legAccountabilityForm" onSubmit={onSave}>
      <label>Chamber<select name="chamber" required value={editor.chamber} onChange={update}>
        <option value="">Select a chamber</option>
        {Object.entries(chambers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Congress number<input type="number" name="congress" min="8" max="200" required value={editor.congress} onChange={update} /></label>
      {kind !== 'ATTENDANCE' && <label>{kind === 'VOTE' ? 'Measure title' : 'Committee name'}
        <input name="title" maxLength={300} required value={editor.title} onChange={update} />
      </label>}
      {kind !== 'COMMITTEE' && <label>{kind === 'VOTE' ? 'Measure number and roll-call reference' : 'Session reference'}
        <input name="reference" maxLength={150} required value={editor.reference} onChange={update} />
      </label>}
      <label>{kind === 'VOTE' ? 'Voting date' : kind === 'ATTENDANCE' ? 'Session date' : 'Start date (if known)'}
        <input type="date" name="eventDate" required={kind !== 'COMMITTEE'} value={editor.eventDate} onChange={update} />
      </label>
      {kind === 'COMMITTEE' && <label>End date (if known)<input type="date" name="endDate" value={editor.endDate} onChange={update} /></label>}
      <label>{kind === 'COMMITTEE' ? 'Committee position' : kind === 'VOTE' ? 'Voting decision' : 'Attendance status'}
        <select name="decision" required value={editor.decision} onChange={update}>
          <option value="">Select a status</option>
          {kinds[kind].slice(1).map(value => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </label>
      <label>Verification status<select name="verificationStatus" value={verificationStatus} onChange={update}>
        {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label className="legAccountabilityWide">Official source URL
        <input type="url" name="sourceUrl" maxLength={2048} required={verified} value={editor.sourceUrl} onChange={update} />
      </label>
      <label className="legAccountabilityWide">Private verification notes
        <textarea name="verificationNotes" rows={3} maxLength={5000} required={verified} value={editor.verificationNotes}
          placeholder="Identify the page, named entry, and context in the official document." onChange={update} />
      </label>
      {error && <p className="legAccountabilityWide prMuted" role="alert">{error}</p>}
      {withdrawnAt && <p className="legAccountabilityWide">Saving a withdrawn record restores it. Verified records are visible on the public profile.</p>}
      <div className="legAccountabilityActions legAccountabilityWide">
        <button type="button" className="prBtn prBtnOutline" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="submit" className="prBtn prBtnPrimaryDark" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
      </div>
    </form>
  </BaseModal>
}

export default function LegislativeAccountabilitySection({ politicianId, isAdmin, token, preferredChamber }) {
  const [kind, setKind] = useState('ATTENDANCE')
  const [congress, setCongress] = useState('')
  const [chamber, setChamber] = useState('')
  const [offset, setOffset] = useState(0)
  const [managing, setManaging] = useState(false)
  const [editor, setEditor] = useState(null)
  const [result, setResult] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const submitting = useRef(false)
  const admin = Boolean(isAdmin && token && managing)
  const path = legislativeAccountabilityPath(politicianId, admin)
  const params = new URLSearchParams({ kind, offset, limit })
  if (Number(congress) >= 8 && Number(congress) <= 200) params.set('congress', congress)
  if (chamber) params.set('chamber', chamber)
  const url = `${path}?${params}`
  const readToken = admin ? token : null

  useEffect(() => {
    const controller = new AbortController()
    legislativeAccountabilityRequest(url, { token: readToken, signal: controller.signal })
      .then(page => {
        if (!controller.signal.aborted) setResult({ url, refresh, token: readToken, page })
      }).catch(error => {
        if (!controller.signal.aborted) setResult({ url, refresh, token: readToken, error: error.message })
      })
    return () => controller.abort()
  }, [url, readToken, refresh])

  const current = result?.url === url && result.refresh === refresh && result.token === readToken ? result : null
  const page = current?.page
  const openEditor = item => {
    setFormError('')
    setEditor({
      kind, chamber: chamber || preferredChamber || '', congress,
      decision: '', verificationStatus: 'PENDING_VERIFICATION',
      ...item?.record,
      title: item?.record.title || '', reference: item?.record.reference || '', eventDate: item?.record.eventDate || '',
      endDate: item?.record.endDate || '', sourceUrl: item?.record.sourceUrl || '',
      verificationNotes: item?.verificationNotes || '', revision: item?.revision, withdrawnAt: item?.withdrawnAt,
    })
  }

  async function change(action, target) {
    if (!admin || submitting.current) return
    submitting.current = true
    setBusy(true)
    setFeedback('')
    setFormError('')
    try {
      if (action === 'DELETE') {
        await legislativeAccountabilityRequest(`${path}/${target.record.recordId}?revision=${target.revision}`, { method: action, token })
      } else {
        const { recordId, kind, chamber, congress, decision, title, reference, eventDate, endDate,
          sourceUrl, verificationStatus, verificationNotes, revision } = target
        await legislativeAccountabilityRequest(recordId ? `${path}/${recordId}` : path, {
          method: recordId ? 'PUT' : 'POST', token,
          body: { kind, chamber, congress: Number(congress), decision, title, reference, eventDate: eventDate || null,
            endDate: endDate || null, sourceUrl, verificationStatus, verificationNotes, revision },
        })
        setEditor(null)
      }
      setFeedback(action === 'DELETE' ? 'Record withdrawn.' : 'Record saved.')
      setOffset(0)
      setRefresh(value => value + 1)
    } catch (error) {
      if (action === 'DELETE') setFeedback(error.message)
      else setFormError(error.message)
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <section className="prCard legAccountability" aria-label="Legislative accountability">
    <div className="prCardHead">
      <h2 className="prCardTitle">Legislative accountability</h2>
      {isAdmin && token && <button type="button" className="prBtn prBtnOutline" disabled={busy} onClick={() => {
        setManaging(!managing)
        setOffset(0)
        setEditor(null)
        setFeedback('')
      }}>{admin ? 'View public records' : 'Manage records'}</button>}
    </div>
    <div className="legAccountabilityFilters">
      <label>Record type<select value={kind} onChange={event => { setKind(event.target.value); setOffset(0) }}>
        {Object.entries(kinds).map(([value, [label]]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Chamber<select value={chamber} onChange={event => { setChamber(event.target.value); setOffset(0) }}>
        <option value="">All chambers</option>
        {Object.entries(chambers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Congress number<input type="number" min="8" max="200" value={congress} placeholder="All terms"
        onChange={event => { setCongress(event.target.value); setOffset(0) }} /></label>
    </div>
    {admin && page?.available && <button type="button" className="prBtn prBtnPrimaryDark" disabled={busy} onClick={() => openEditor()}>Add record</button>}
    {feedback && <p role="status">{feedback}</p>}
    {!current && <p role="status">Loading legislative accountability…</p>}
    {current?.error && <p role="alert">{current.error} <button type="button" className="prBtn prBtnOutline" onClick={() => setRefresh(value => value + 1)}>Retry</button></p>}
    {page && !page.available && <p className="prMuted">Legislative accountability data is currently unavailable.</p>}
    {page?.available && <>
      <AttendanceSummaries summaries={page.attendance} />
      {page.records.length === 0 && <p className="prMuted">{admin ? 'No records match these filters.' : `No verified ${emptyLabels[kind]} are available for this selection.`}</p>}
      <ul className="legAccountabilityRecords">
        {page.records.map(item => {
          const record = admin ? item.record : item
          return <li key={record.recordId}>
            <LegislativeAccountabilityRecord record={record} />
            {admin && <>
              {item.withdrawnAt && <p>Withdrawn</p>}
              {item.verificationNotes && <p className="legAccountabilityNotes">{item.verificationNotes}</p>}
              <div className="legAccountabilityActions">
                <button type="button" className="prBtn prBtnOutline" disabled={busy} onClick={() => openEditor(item)}>Edit record</button>
                {!item.withdrawnAt && <button type="button" className="prBtn prBtnOutline" disabled={busy}
                  onClick={() => { if (window.confirm('Withdraw this legislative record from public display?')) change('DELETE', item) }}>
                  Withdraw record
                </button>}
              </div>
            </>}
          </li>
        })}
      </ul>
      {(offset > 0 || page.hasMore) && <nav className="legAccountabilityActions" aria-label="Legislative accountability pagination">
        <button type="button" className="prBtn prBtnOutline" disabled={offset === 0} onClick={() => setOffset(offset - limit)}>Previous page</button>
        <span>Page {offset / limit + 1}</span>
        <button type="button" className="prBtn prBtnOutline" disabled={!page.hasMore} onClick={() => setOffset(offset + limit)}>Next page</button>
      </nav>}
    </>}
    {admin && editor && <RecordEditor editor={editor} setEditor={setEditor} busy={busy} error={formError}
      onSave={event => { event.preventDefault(); change('SAVE', editor) }} onClose={() => setEditor(null)} />}
  </section>
}
