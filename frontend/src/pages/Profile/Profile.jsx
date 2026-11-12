import { useEffect, useState } from 'react'
import { BarChart3Icon, FolderIcon } from '../../components/icons/Lucide'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { KpiGrid, PaginationMini, ProfileSkeleton, StatusLine, TimelineLedger } from '../pageHelpers'
import PoliticianEditor from '../../components/governance/PoliticianEditor'
import EditSubmissionForm from '../../components/governance/EditSubmissionForm'
import CongressProfilePanel from '../../components/governance/CongressProfilePanel'
import CongressSourceSection from '../../components/governance/CongressSourceSection'
import AccomplishmentsSection from '../../components/governance/AccomplishmentsSection'
import CongressMembershipSummary from '../../components/governance/CongressMembershipSummary'
import { formatDisplayName } from '../../features/congress/displayName'
import BaseModal from '../../components/BaseModal'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'
import './Profile.css'

const RECORDS_PER_PAGE = 9

function exportLedger(entries, profile, type) {
  const data = type === 'json'
    ? JSON.stringify({
        metadata: {
          politicianId: profile.politicianId,
          fullName: profile.fullName,
          exportedAt: new Date().toISOString(),
        },
        timelineEntries: entries,
      }, null, 2)
    : [
        ['Date', 'Category', 'Action Type', 'Summary', 'Source Citation', 'Status'],
        ...entries.map((entry) => [
          entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : '',
          entry.categoryTag || '',
          entry.actionIdentifier || '',
          entry.summary || entry.impactSummary || '',
          entry.sourceUrl || '',
          entry.status || 'PUBLISHED',
        ]),
      ].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n')

  const url = URL.createObjectURL(new Blob([data], { type: type === 'json' ? 'application/json' : 'text/csv' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${(profile.fullName || 'politician').toLowerCase().replace(/[^a-z0-9]+/g, '_')}_records.${type === 'json' ? 'json' : 'csv'}`
  link.click()
  URL.revokeObjectURL(url)
}

function initials(name = '') {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'PH'
}

function paginate(items, page, size = RECORDS_PER_PAGE) {
  const totalPages = Math.max(1, Math.ceil(items.length / size))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * size
  return {
    pageItems: items.slice(start, start + size),
    totalPages,
    safePage,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
    total: items.length,
  }
}

function Pager({ paged, onChange, label }) {
  return (
    <nav className="prPager" aria-label={label}>
      <p>Showing <strong>{paged.from}–{paged.to}</strong> of <strong>{paged.total}</strong> records</p>
      <PaginationMini page={paged.safePage} totalPages={paged.totalPages} onChange={onChange} />
    </nav>
  )
}

export default function PoliticianProfilePage({
  dbUser,
  onAddContribution,
  onModalOpenChange,
  onPoliticianUpdate,
  onReload,
  politicianId,
  politicians,
  state,
  token,
}) {
  const fallback = politicians.find((p) => p.politicianId === politicianId)
  const profile = state.data || fallback
  const dashboardMatchesProfile = state.data?.politicianId === politicianId
  const entries = dashboardMatchesProfile
    ? (state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || [])
    : []
  const verifiedEntries = entries.filter((entry) => entry.actionDetails?.sourceReported !== true)
  const relatedNews = state.data?.relatedNews || []
  const [recordQuery, setRecordQuery] = useState('')
  const [recordType, setRecordType] = useState('ALL')
  const [recordPage, setRecordPage] = useState(1)
  const [draftPage, setDraftPage] = useState(1)
  const [managePage, setManagePage] = useState(1)
  const visibleEntries = verifiedEntries.filter((entry) => {
    const legislative = ['BILL', 'MEMBERSHIP'].includes(entry.actionDetails?.recordType) || Boolean(entry.actionDetails?.openCongressId)
    if (recordType === 'LEGISLATION' && !legislative) return false
    if (recordType === 'OTHER' && legislative) return false
    const query = recordQuery.trim().toLowerCase()
    return !query || [entry.summary, entry.actionDetails?.legislationTitle, entry.actionDetails?.verifiedStatus]
      .some((value) => String(value || '').toLowerCase().includes(query))
  })
  const [editing, setEditing] = useState(false)
  const [record, setRecord] = useState(null)
  const [recordState, setRecordState] = useState({ status: 'idle', message: '' })
  const [congressDrafts, setCongressDrafts] = useState([])
  const [draftReview, setDraftReview] = useState(null)
  const isAdmin = dbUser?.role === 'ADMIN'
  const [archived, setArchived] = useState(false)

  useEffect(() => { setArchived(false); setCongressDrafts([]); setDraftReview(null); setRecordPage(1); setDraftPage(1); setManagePage(1) }, [politicianId])

  // The "Profiles / Published Profile Dashboard" heading comes from the app shell, not from this page.
  // Until it is deleted at its source, hide it (matched by its text) while this page is open.
  useEffect(() => {
    const page = document.querySelector('.profilePage')
    if (!page) return undefined
    const pattern = /published profile dashboard/i
    let node = page
    for (let depth = 0; node && depth < 5; depth += 1, node = node.parentElement) {
      const sibling = node.previousElementSibling
      if (sibling && pattern.test(sibling.textContent || '') && !sibling.querySelector('.profilePage')) {
        const previousDisplay = sibling.style.display
        sibling.style.display = 'none'
        return () => { sibling.style.display = previousDisplay }
      }
    }
    return undefined
  }, [])
  useEffect(() => { setRecordPage(1) }, [recordQuery, recordType])

  useEffect(() => {
    if (!isAdmin || !politicianId || !token) return undefined
    const controller = new AbortController()
    congressRequest(`/politicians/${politicianId}/drafts`, token, { signal: controller.signal })
      .then(setCongressDrafts)
      .catch((error) => { if (error.name !== 'AbortError') setRecordState({ status: 'error', message: error.message }) })
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
        await congressRequest(`/records/${record.timelineId}/verification`, token, {
          method: 'PUT',
          body: JSON.stringify({
            sourceUrl: record.sourceUrl,
            verificationNotes: record.verificationNotes,
            verifiedStatus: record.actionDetails.verifiedStatus,
            summary: record.impactSummary,
          }),
        })
      } else {
        const details = Object.fromEntries(Object.entries(record.actionDetails || {}).map(([key, value]) => [
          key,
          ['flaggedAmount', 'allocationAmount', 'completionPercentage'].includes(key) ? Number(value) : value,
        ]))
        await fetch(`${API_BASE_URL}/api/admin/curation/metrics/${record.timelineId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      await congressRequest(`/drafts/${draftReview.timelineId}/publish`, token, {
        method: 'POST',
        body: JSON.stringify({
          sourceUrl: draftReview.sourceUrl,
          verificationNotes: draftReview.verificationNotes,
          verifiedStatus: draftReview.verifiedStatus,
          summary: draftReview.summary,
        }),
      })
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

  if (archived) {
    return (
      <section className="workspace profilePage">
        <p className="prEmpty">Profile archived. Existing records have been preserved.</p>
      </section>
    )
  }
  if (!politicianId) {
    return (
      <section className="workspace profilePage">
        <p className="prEmpty">Select a politician first.</p>
      </section>
    )
  }

  const isLoading = recordState.status === 'loading'
  const recordsPaged = paginate(visibleEntries, recordPage)
  const draftsPaged = paginate(congressDrafts, draftPage)
  const managePaged = paginate(verifiedEntries, managePage)
  const position = profile ? (profile.position ? formatPosition(profile.position) : 'Current office unverified') : ''
  const jurisdiction = profile ? formatJurisdiction(profile.jurisdiction) || 'Unspecified jurisdiction' : ''
  const party = profile ? profile.partyAffiliation || 'Party affiliation unavailable' : ''
  const term = profile ? `${profile.termStart || 'Start date unverified'} to ${profile.termEnd || 'End date unverified'}` : ''
  const termEnded = Boolean(profile?.termEnd && profile.termEnd < new Date().toISOString().slice(0, 10))
  const displayName = formatDisplayName(profile?.fullName || '')

  return (
    <section className="workspace profilePage">
      <StatusLine state={state} />
      {state.status === 'loading' && !profile && <ProfileSkeleton />}

      {profile && (
        <>
          <header className="prHero">
            <div className="prHeroMain">
              <span className="prAvatar">
                {profile.profileImageUrl && (
                  <img
                    alt={`${profile.fullName} profile`}
                    onError={(event) => { event.currentTarget.hidden = true }}
                    src={profile.profileImageUrl}
                  />
                )}
                {!profile.profileImageUrl && <span aria-hidden="true">{initials(profile.fullName)}</span>}
              </span>
              <div className="prIdentity">
                <h1>{displayName.name}</h1>
                {displayName.needsReview && <p className="prNotice">Name formatting requires review</p>}
                <CongressMembershipSummary politicianId={politicianId} detailed />
                {(profile.position || profile.jurisdiction || profile.partyAffiliation) && <p className="prIdentityMeta">
                  {profile.position && <span>{position}</span>}
                  {profile.jurisdiction && <span>{jurisdiction}</span>}
                  {profile.partyAffiliation && <span>{party}</span>}
                </p>}
                {(profile.termStart || profile.termEnd) && <p className="prTerm">Recorded term: {term}.</p>}
                {termEnded && (
                  <p className="prNotice">This term has ended; current office information may be outdated.</p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="prHeroActions">
                <button className="prBtn prBtnPrimary" type="button" onClick={() => onAddContribution(politicianId)}>Add verified record</button>
                <button className="prBtn prBtnGhost" type="button" onClick={() => setEditing(true)}>Edit Profile</button>
                <button className="prBtn prBtnDanger" type="button" disabled={isLoading} onClick={archiveProfile}>Archive profile</button>
              </div>
            )}
          </header>

          <section className="prKpis" aria-label="Key figures">
            <KpiGrid profile={profile} />
          </section>

          <div className="prLayout">
            <div className="prMain">
              <section className="prCard prBio">
                <h2 className="prCardTitle">Biography</h2>
                <p>{profile.biography || 'No biography available.'}</p>
              </section>

              <CongressSourceSection key={`congress-source:${politicianId}`} politicianId={politicianId} isAdmin={isAdmin} token={token} />

              <AccomplishmentsSection key={`accomplishments:${politicianId}:${isAdmin}`} politicianId={politicianId} isAdmin={isAdmin} token={token} />

              <StatusLine state={recordState} />

              {isAdmin && (
                <CongressProfilePanel key={`congress-admin:${politicianId}`} politicianId={politicianId} token={token} onDraftCreated={loadCongressDrafts} />
              )}

              {isAdmin && (
                <section className="prCard" aria-label="Congress drafts pending verification">
                  <div className="prCardHead">
                    <h2 className="prCardTitle">Congress records awaiting verification</h2>
                    <span className="prCount">{congressDrafts.length}</span>
                  </div>
                  {congressDrafts.length === 0 && (
                    <p className="prMuted">No linked drafts. Open a membership or authored bill in the Congress source panel to create one.</p>
                  )}
                  <div className="prDraftList">
                    {draftsPaged.pageItems.map((draft) => (
                      <div className="prDraft" key={draft.timelineId}>
                        <div>
                          <p className="prDraftTitle">
                            <strong>{draft.actionDetails?.recordType === 'MEMBERSHIP' ? `Congress ${draft.actionDetails.congress || 'Unknown'} membership` : draft.actionDetails?.legislationTitle || 'Untitled bill'}</strong>
                            <span className="prBadge">Private draft</span>
                          </p>
                          <p className="prMuted">{draft.summary}</p>
                        </div>
                        <button
                          className="prBtn prBtnOutline"
                          type="button"
                          onClick={() => setDraftReview({
                            timelineId: draft.timelineId,
                            sourceUrl: draft.sourceUrl || '',
                            verificationNotes: '',
                            verifiedStatus: '',
                            summary: draft.summary,
                          })}
                        >
                          Review and verify
                        </button>
                      </div>
                    ))}
                  </div>
                  <Pager paged={draftsPaged} onChange={setDraftPage} label="Draft pagination" />

                  {draftReview && (
                    <div className="prReview">
                      <h3>Verify the original Congress record and status</h3>
                      <label>Public summary
                        <textarea value={draftReview.summary} onChange={(event) => setDraftReview((current) => ({ ...current, summary: event.target.value }))} />
                      </label>
                      <label>Official source URL
                        <input type="url" value={draftReview.sourceUrl} onChange={(event) => setDraftReview((current) => ({ ...current, sourceUrl: event.target.value }))} />
                      </label>
                      <label>Verified status
                        <input value={draftReview.verifiedStatus} onChange={(event) => setDraftReview((current) => ({ ...current, verifiedStatus: event.target.value }))} placeholder="Filed, referred, enacted, or unknown" />
                      </label>
                      <label>Evidence and review notes
                        <textarea value={draftReview.verificationNotes} onChange={(event) => setDraftReview((current) => ({ ...current, verificationNotes: event.target.value }))} />
                      </label>
                      <div className="prReviewActions">
                        <button
                          className="prBtn prBtnPrimaryDark"
                          type="button"
                          disabled={isLoading || !draftReview.summary.trim() || !draftReview.sourceUrl || !draftReview.verifiedStatus || draftReview.verificationNotes.trim().length < 20}
                          onClick={publishCongressDraft}
                        >
                          Publish verified record
                        </button>
                        <button className="prBtn prBtnOutline" type="button" onClick={() => setDraftReview(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="prCard prTimeline" aria-label="Verified public records">
                <div className="prCardHead">
                  <div>
                    <h2 className="prCardTitle">Browse verified records</h2>
                    <p className="prCardHint">Search and filter, {RECORDS_PER_PAGE} records per page.</p>
                  </div>
                  <span className="prCount">{visibleEntries.length}</span>
                </div>

                <div className="prToolbar" role="search" aria-label="Filter verified records">
                  <label className="prField prSearch">
                    <span>Search verified records</span>
                    <input value={recordQuery} onChange={(event) => setRecordQuery(event.target.value)} placeholder="Bill title, status, or activity" />
                  </label>
                  <label className="prField">
                    <span>Record type</span>
                    <select value={recordType} onChange={(event) => setRecordType(event.target.value)}>
                      <option value="ALL">All records</option>
                      <option value="LEGISLATION">Legislation</option>
                      <option value="OTHER">Other activities</option>
                    </select>
                  </label>
                </div>

                <TimelineLedger className="prLedger" entries={recordsPaged.pageItems} isLoading={state.status === 'loading'} allowChallenge={false} title="Verified public records" />
                <Pager paged={recordsPaged} onChange={setRecordPage} label="Record pagination" />
              </section>

              <section className="prCard prNewsCard" aria-label="Related published news">
                <h2 className="prCardTitle">Related government news</h2>
                {relatedNews.length === 0 ? (
                  <p className="prMuted">No reviewed news articles are linked to this politician.</p>
                ) : (
                  <ul className="prNews">
                    {relatedNews.map((item) => (
                      <li key={item.id}>
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.headline}</a>
                        <p className="prNewsMeta">{item.sourceName} · {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-PH') : 'Date unavailable'}</p>
                        <p className="prMuted">{item.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {isAdmin && verifiedEntries.length > 0 && (
                <details className="prCard prManage">
                  <summary>Manage published records <span className="prCount">{verifiedEntries.length}</span></summary>
                  <div className="prManageList">
                    {managePaged.pageItems.map((entry) => (
                      <div className="prManageRow" key={entry.timelineId}>
                        <p>{entry.summary}</p>
                        <div className="prManageActions">
                          <button
                            className="prBtn prBtnOutline"
                            type="button"
                            disabled={isLoading}
                            onClick={() => { setRecord({ ...entry, impactSummary: entry.summary }); setRecordState({ status: 'idle', message: '' }) }}
                          >
                            Edit record
                          </button>
                          <button className="prBtn prBtnDangerOutline" type="button" disabled={isLoading} onClick={() => hideRecord(entry)}>Remove record</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pager paged={managePaged} onChange={setManagePage} label="Manage records pagination" />
                </details>
              )}
            </div>

            <aside className="prAside" aria-label="Profile details">
              <section className="prCard">
                <h2 className="prCardTitle">Quick facts</h2>
                <dl className="prFacts">
                  <div><dt>Position</dt><dd>{position}</dd></div>
                  <div><dt>Jurisdiction</dt><dd>{jurisdiction}</dd></div>
                  <div><dt>Party</dt><dd>{party}</dd></div>
                  <div><dt>Term</dt><dd>{term}</dd></div>
                  <div><dt>Verified records</dt><dd>{verifiedEntries.length}</dd></div>
                </dl>
              </section>

              <section className="prCard">
                <h2 className="prCardTitle">Export records</h2>
                <p className="prCardHint">Download this politician’s published timeline.</p>
                <div className="prExports">
                  <button className="prBtn prBtnFull prBtnCsv" type="button" onClick={() => exportLedger(entries, profile, 'csv')}>
                    <BarChart3Icon size={16} /> Export CSV
                  </button>
                  <button className="prBtn prBtnFull prBtnJson" type="button" onClick={() => exportLedger(entries, profile, 'json')}>
                    <FolderIcon size={16} /> Export JSON
                  </button>
                </div>
              </section>
            </aside>
          </div>

          {isAdmin && editing && (
            <PoliticianEditor
              politician={{ ...fallback, ...profile, politicianId }}
              token={token}
              onClose={() => setEditing(false)}
              onSaved={(saved) => { onPoliticianUpdate(politicianId, saved); onReload(politicianId) }}
            />
          )}

          {isAdmin && record && (
            <BaseModal isOpen title="Edit verified record" onClose={() => setRecord(null)} isDismissDisabled={isLoading}>
              <div className="prModalContent">
                {record.actionDetails?.openCongressId ? (
                  <form className="editorPanel prForm" onSubmit={saveRecord}>
                    <p className="prMuted">Update the verified claim using its official record. Imported source details remain attached.</p>
                    <label>Public summary
                      <textarea required value={record.impactSummary || ''} onChange={(event) => setRecord((current) => ({ ...current, impactSummary: event.target.value }))} />
                    </label>
                    <label>Official source URL
                      <input required type="url" value={record.sourceUrl || ''} onChange={(event) => setRecord((current) => ({ ...current, sourceUrl: event.target.value }))} />
                    </label>
                    <label>Verified status
                      <input required value={record.actionDetails?.verifiedStatus || ''} onChange={(event) => setRecord((current) => ({ ...current, actionDetails: { ...current.actionDetails, verifiedStatus: event.target.value } }))} />
                    </label>
                    <label>Evidence and review notes
                      <textarea required minLength={20} value={record.verificationNotes || ''} onChange={(event) => setRecord((current) => ({ ...current, verificationNotes: event.target.value }))} />
                    </label>
                    <button className="prBtn prBtnPrimaryDark" disabled={isLoading} type="submit">Save verified record</button>
                    <StatusLine state={recordState} />
                  </form>
                ) : (
                  <EditSubmissionForm
                    formData={record}
                    politicians={politicians}
                    selectedPoliticianId={politicianId}
                    state={recordState}
                    onChange={(event) => setRecord((current) => ({ ...current, [event.target.name]: event.target.value }))}
                    onDetailChange={(key, value) => setRecord((current) => ({ ...current, actionDetails: { ...current.actionDetails, [key]: value } }))}
                    onDomainCheck={() => {}}
                    onSubmit={saveRecord}
                  />
                )}
                <button className="prBtn prBtnOutline" type="button" disabled={isLoading} onClick={() => setRecord(null)}>Cancel</button>
              </div>
            </BaseModal>
          )}
        </>
      )}
    </section>
  )
}
