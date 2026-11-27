import { profileSections } from '../../config/appRoutes'
import { safeNewsUrl } from '../../features/news/newsPresentation'
import { useEffect, useState } from 'react'
import { ArrowRightIcon, CircleCheckIcon, FileTextIcon, FolderIcon, LayoutDashboardIcon, ScrollTextIcon, ShieldCheckIcon } from '../../components/icons/Lucide'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { KpiGrid, PaginationMini, ProfileSkeleton, StatusLine } from '../pageHelpers'
import PoliticianEditor from '../../components/governance/PoliticianEditor'
import EditSubmissionForm from '../../components/governance/EditSubmissionForm'
import CongressProfilePanel from '../../components/governance/CongressProfilePanel'
import CongressSourceSection from '../../components/governance/CongressSourceSection'
import LegislativeAccountabilitySection from '../../components/governance/LegislativeAccountabilitySection'
import AccomplishmentsSection from '../../components/governance/AccomplishmentsSection'
import AccountabilityRecords from '../../components/governance/AccountabilityRecords'
import ProfileBiography from '../../components/governance/ProfileBiography'
import { useCitationReviews } from '../../features/verification/citationReviews'
import { accountabilityRecords, filterAccountabilityRecords } from '../../features/congress/accountabilityRecords'
import CongressMembershipSummary from '../../components/governance/CongressMembershipSummary'
import { formatDisplayName } from '../../features/congress/displayName'
import { chamberForPosition, matchesBranch } from '../../features/congress/politicianDirectory'
import { useCongressMemberships, useLegislativeAccountabilityAvailability } from '../../features/congress/useCongressMemberships'
import BaseModal from '../../components/BaseModal'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'
import './Profile.css'

const RECORDS_PER_PAGE = 9
const sectionDetails = {
  overview: { label: 'Overview', Icon: LayoutDashboardIcon },
  accountability: { label: 'Accountability Records', Icon: ShieldCheckIcon },
  'legislative-records': { label: 'Legislative Records', Icon: ScrollTextIcon },
  accomplishments: { label: 'Accomplishments', Icon: CircleCheckIcon },
}

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
  onDirectory,
  onSectionChange,
  profileHref,
  section = 'overview',
  politicianId,
  politicians,
  state,
  token,
}) {
  const fallback = politicians.find((p) => p.politicianId === politicianId)
  const profile = state.status === 'notFound' ? null : state.data || fallback
  const dashboardMatchesProfile = state.data?.politicianId === politicianId
  const entries = dashboardMatchesProfile
    ? (state.data?.publishedTimelineLedger || state.data?.timeline || state.data?.entries || [])
    : []
  const verifiedEntries = entries.filter((entry) => entry.actionDetails?.sourceReported !== true)
  const relatedNews = state.data?.relatedNews || []
  const [recordQuery, setRecordQuery] = useState('')
  const [recordType, setRecordType] = useState('ALL')
  const [recordPage, setRecordPage] = useState(1)
  const [curatedPage, setCuratedPage] = useState(1)
  const [draftPage, setDraftPage] = useState(1)
  const [managePage, setManagePage] = useState(1)
  const [accomplishments, setAccomplishments] = useState({ records: [], loading: true, error: '' })
  const citationReviews = useCitationReviews(politicianId)
  const publicEntries = accountabilityRecords(verifiedEntries, accomplishments.politicianId === politicianId ? accomplishments.records : [])
  const visibleEntries = filterAccountabilityRecords(publicEntries, recordType, recordQuery)
  const [editing, setEditing] = useState(false)
  const [record, setRecord] = useState(null)
  const [recordState, setRecordState] = useState({ status: 'idle', message: '' })
  const [congressDrafts, setCongressDrafts] = useState([])
  const [draftReview, setDraftReview] = useState(null)
  const isAdmin = dbUser?.role === 'ADMIN'
  const executive = profile && matchesBranch(profile, 'EXECUTIVE')
  const congressHistory = useCongressMemberships(executive ? politicianId : null)
  const hasLegislativeAccountability = useLegislativeAccountabilityAvailability(executive ? politicianId : null)
  const [archived, setArchived] = useState(false)

  useEffect(() => { setArchived(false); setCongressDrafts([]); setDraftReview(null); setRecordPage(1); setDraftPage(1); setManagePage(1) }, [politicianId])

  // The "Profiles / Published Profile Dashboard" heading comes from the app shell, not from this page.
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
    setRecordState({ status: 'loading', message: 'Saving accountability record...' })
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
      setRecordState({ status: 'success', message: 'Accountability record published.' })
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
  if (!politicianId || state.status === 'notFound' || (!profile && state.status === 'error')) {
    return (
      <section className="workspace profilePage">
        <h1>{state.status === 'error' ? 'Profile unavailable' : 'Politician profile not found'}</h1>
        {state.status === 'error' && <p role="alert">{state.message}</p>}
        {state.status === 'error' && <button className="prBtn prBtnOutline" type="button" onClick={() => onReload(politicianId)}>Retry profile</button>}
        <button className="prBtn prBtnOutline" type="button" onClick={onDirectory}>Browse politicians</button>
      </section>
    )
  }

  const isLoading = recordState.status === 'loading'
  const recordsPaged = paginate(visibleEntries, recordPage)
  const draftsPaged = paginate(congressDrafts, draftPage)
  const managePaged = paginate(verifiedEntries, managePage)
  const curatedBills = verifiedEntries.filter(entry => entry.actionIdentifier === 'SPONSORED_LEGISLATION')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(a.timelineId).localeCompare(String(b.timelineId)))
  const curatedPaged = paginate(curatedBills, curatedPage, 10)
  const showCongressHistory = !executive || congressHistory.memberships.length > 0 || congressHistory.authoredCount > 0
  const showLegislation = showCongressHistory || isAdmin || curatedBills.length > 0 || hasLegislativeAccountability
  const visibleSection = section === 'legislative-records' && !showLegislation ? 'overview' : section
  const position = profile ? (profile.position ? formatPosition(profile.position) : 'Current office unverified') : ''
  const jurisdiction = profile ? formatJurisdiction(profile.jurisdiction) || 'Unspecified jurisdiction' : ''
  const party = profile ? profile.partyAffiliation || 'Party affiliation unavailable' : ''
  const term = profile ? `${profile.termStart || 'Start date unverified'} to ${profile.termEnd || 'End date unverified'}` : ''
  const termEnded = Boolean(profile?.termEnd && profile.termEnd < new Date().toISOString().slice(0, 10))
  const displayName = formatDisplayName(profile?.fullName || '')

  return (
    <section className="workspace profilePage">
      <StatusLine state={state} />
      {state.status === 'error' && <button className="prBtn prBtnOutline" type="button" onClick={() => onReload(politicianId)}>Retry profile</button>}
      {state.status === 'loading' && !profile && <ProfileSkeleton />}

      {profile && (
        <>
          <header className="prHero">
            <div className="prHeroMain">
              <span className="prAvatar">
                <span aria-hidden="true">{initials(profile.fullName)}</span>
                {profile.profileImageUrl && (
                  <img
                    alt={`${profile.fullName} profile`}
                    onError={(event) => { event.currentTarget.hidden = true }}
                    src={profile.profileImageUrl}
                  />
                )}
              </span>
              <div className="prIdentity">
                <h1>{displayName.name}</h1>
                {displayName.needsReview && <p className="prNotice">Name formatting requires review</p>}
                {(profile.position || profile.jurisdiction || profile.partyAffiliation) && <p className="prIdentityMeta">
                  {profile.position && <span>{position}</span>}
                  {profile.jurisdiction && <span>{jurisdiction}</span>}
                  {profile.partyAffiliation && <span>{party}</span>}
                </p>}
                {(profile.termStart || profile.termEnd) && <p className="prTerm">Recorded term: {term}.</p>}
                {showCongressHistory && <CongressMembershipSummary politicianId={politicianId} detailed />}
                {termEnded && (
                  <p className="prNotice">This term has ended; current office information may be outdated.</p>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="prHeroActions">
                <button className="prBtn prBtnPrimary" type="button" onClick={() => onAddContribution(politicianId)}>Add accountability record</button>
                <button className="prBtn prBtnGhost" type="button" onClick={() => setEditing(true)}>Edit Profile</button>
                <button className="prBtn prBtnDanger" type="button" disabled={isLoading} onClick={archiveProfile}>Archive profile</button>
              </div>
            )}
          </header>

          <nav className="prTabs" aria-label="Profile sections">
            {profileSections.filter(value => value !== 'legislative-records' || showLegislation).map(value => {
              const { label, Icon } = sectionDetails[value]
              return <a key={value} href={profileHref(value)}
                aria-current={visibleSection === value ? 'page' : undefined} onClick={event => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                  event.preventDefault()
                  onSectionChange(value)
                }}>
                <Icon size={18} />
                <span>{label}</span>
              </a>
            })}
          </nav>
          <StatusLine state={recordState} />

          {visibleSection === 'overview' && <div className="prLayout">
            <div className="prMain">
              <section className="prCard prBio">
                <h2 className="prCardTitle">Biography</h2>
                <ProfileBiography biography={profile.biography} review={citationReviews.get(politicianId)} />
              </section>

              <section className="prCard">
                <h2 className="prCardTitle">Accountability summary</h2>
                <div className="prScoreBody">
                  {profile.wgiCompositeScore == null ? <p className="prMuted">Accountability data is currently unavailable.</p> :
                    <div className="prScoreReadout">
                      <p>WGI Composite Score</p>
                      <p className="prScoreValue">
                        <strong>{Number(profile.wgiCompositeScore).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</strong>
                        <span>out of 100</span>
                      </p>
                    </div>}
                  <a className="prPanelLink" href={profileHref('accountability')} onClick={event => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    onSectionChange('accountability')
                  }}>View accountability records <ArrowRightIcon size={16} /></a>
                </div>
              </section>
              <section className="prCard prNewsCard" aria-label="Related published news">
                <h2 className="prCardTitle">Related government news</h2>
                {relatedNews.length === 0 ? (
                  <p className="prMuted prEmptyState">No reviewed news articles are linked to this politician.</p>
                ) : (
                  <ul className="prNews">
                    {relatedNews.map((item) => (
                      <li key={item.id}>
                        {safeNewsUrl(item.sourceUrl) ? <a href={safeNewsUrl(item.sourceUrl)} target="_blank" rel="noopener noreferrer">{item.headline}</a> : <strong>{item.headline}</strong>}
                        <p className="prNewsMeta">{item.sourceName} · {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('en-PH') : 'Date unavailable'}</p>
                        <p className="prMuted">{item.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

            </div>
            <aside className="prAside" aria-label="Profile details">
              <section className="prCard">
                <h2 className="prCardTitle">Quick facts</h2>
                <dl className="prFacts">
                  <div><dt>Position</dt><dd>{position}</dd></div>
                  <div><dt>Jurisdiction</dt><dd>{jurisdiction}</dd></div>
                  <div><dt>Party</dt><dd>{party}</dd></div>
                  <div><dt>Term</dt><dd>{term}</dd></div>
                </dl>
              </section>

            </aside>
          </div>}

          {section === 'accountability' && <div className="prMain">
            <div className="prCard prIndicators">
              <KpiGrid profile={profile} showExplanations />
            </div>
              <section className="prCard prTimeline" aria-label="Accountability records">
                <div className="prCardHead">
                  <div>
                    <h2 className="prCardTitle">Browse accountability records</h2>
                    <p className="prCardHint">Search and filter, {RECORDS_PER_PAGE} records per page.</p>
                  </div>
                  <span className="prCount">{visibleEntries.length}</span>
                </div>

                <div className="prToolbar" role="search" aria-label="Filter accountability records">
                  <label className="prField prSearch">
                    <span>Search accountability records</span>
                    <input value={recordQuery} onChange={(event) => { setRecordQuery(event.target.value); setRecordPage(1) }} placeholder="Title, category, description, or year" />
                  </label>
                  <label className="prField">
                    <span>Record type</span>
                    <select value={recordType} onChange={(event) => { setRecordType(event.target.value); setRecordPage(1) }}>
                      <option value="ALL">All records</option>
                      <option value="PROJECT_COMPLETION">Project Completion</option>
                      <option value="BUDGET_ALLOCATION">Budget Allocation</option>
                      <option value="COA_FINDING">COA Audit Findings</option>
                      <option value="ACCOMPLISHMENT">Accomplishments</option>
                    </select>
                  </label>
                </div>

                <AccountabilityRecords entries={recordsPaged.pageItems} reviews={citationReviews} loading={state.status === 'loading' || accomplishments.politicianId !== politicianId || accomplishments.loading} emptyMessage={recordType === 'COA_FINDING' && !recordQuery.trim() ? 'No COA findings available.' : 'No accountability records match this selection.'} />
                {state.status === 'success' && <Pager paged={recordsPaged} onChange={setRecordPage} label="Record pagination" />}
                <AccomplishmentsSection key={`accomplishments:${politicianId}:${isAdmin}`} politicianId={politicianId} isAdmin={isAdmin} token={token} embedded showPublic={false} onRecordsChange={setAccomplishments} />
              </section>

              {isAdmin && verifiedEntries.length > 0 && (
                <details className="prCard prManage">
                  <summary>Manage published records <span className="prCount">{verifiedEntries.length}</span></summary>
                  <p className="prMuted">All curated records, including Sponsored Legislation, remain available here for editing and removal. Curated legislation is preserved separately from dataset-reported authored bills.</p>
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
              <section className="prCard prExportCard">
                <div>
                  <h2 className="prCardTitle">Export records</h2>
                  <p className="prCardHint">Download this politician’s published timeline.</p>
                </div>
                <div className="prExports">
                  <button className="prBtn prBtnOutline" type="button" onClick={() => exportLedger(entries, profile, 'csv')}>
                    <FileTextIcon size={16} /> Export CSV
                  </button>
                  <button className="prBtn prBtnOutline" type="button" onClick={() => exportLedger(entries, profile, 'json')}>
                    <FolderIcon size={16} /> Export JSON
                  </button>
                </div>
              </section>
          </div>}

          {visibleSection === 'legislative-records' && <div className="prMain">
              {(showCongressHistory || isAdmin) && <CongressSourceSection key={`congress-source:${politicianId}`} politicianId={politicianId} isAdmin={isAdmin} token={token} />}
              <LegislativeAccountabilitySection key={`legislative-accountability:${politicianId}`}
                politicianId={politicianId} isAdmin={isAdmin} token={token}
                preferredChamber={chamberForPosition(profile.position)?.toUpperCase()} />

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
                          Publish accountability record
                        </button>
                        <button className="prBtn prBtnOutline" type="button" onClick={() => setDraftReview(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </section>
              )}


            {curatedBills.length > 0 && <section className="prCard" aria-label="Published legislative records">
              <h2 className="prCardTitle">Published legislative records</h2>
              <AccountabilityRecords entries={curatedPaged.pageItems} reviews={citationReviews} />
              <Pager paged={curatedPaged} onChange={setCuratedPage} label="Published legislation pagination" />
            </section>}
          </div>}

          {section === 'accomplishments' &&
            <AccomplishmentsSection key={politicianId} politicianId={politicianId} isAdmin={isAdmin} token={token} reviews={citationReviews} />}

          {isAdmin && editing && (
            <PoliticianEditor
              politician={{ ...fallback, ...profile, politicianId }}
              token={token}
              onClose={() => setEditing(false)}
              onSaved={(saved) => { onPoliticianUpdate(politicianId, saved); onReload(politicianId) }}
            />
          )}

          {isAdmin && record && (
            <BaseModal isOpen title="Edit accountability record" onClose={() => setRecord(null)} isDismissDisabled={isLoading}>
              <div className="prModalContent">
                {record.actionDetails?.openCongressId ? (
                  <form className="editorPanel prForm" onSubmit={saveRecord}>
                    <p className="prMuted">Update the accountability record using its official source. Imported source details remain attached.</p>
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
                    <button className="prBtn prBtnPrimaryDark" disabled={isLoading} type="submit">Save accountability record</button>
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
