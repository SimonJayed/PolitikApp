import { LoadingSkeleton } from '../../components/Skeletons'
import { useEffect, useState } from 'react'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { formatDisplayName } from '../../features/congress/displayName'
import { formatWgiScore } from '../../features/congress/wgiLeaderboard'
import CongressProfilePanel from '../../components/governance/CongressProfilePanel'
import CongressSourceSection from '../../components/governance/CongressSourceSection'
import LegislativeAccountabilitySection from '../../components/governance/LegislativeAccountabilitySection'
import AccomplishmentsSection from '../../components/governance/AccomplishmentsSection'
import AccountabilityRecords from '../../components/governance/AccountabilityRecords'
import ProfileBiography from '../../components/governance/ProfileBiography'
import { MobileBudgetTracked } from '../../components/governance/BudgetBreakdown'
import { useCitationReviews } from '../../features/verification/citationReviews'
import { accountabilityRecords } from '../../features/congress/accountabilityRecords'
import CongressMembershipSummary from '../../components/governance/CongressMembershipSummary'
import MobileSegmentedTabs from '../components/tabs/MobileSegmentedTabs'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { chamberForPosition, matchesBranch } from '../../features/congress/politicianDirectory'
import { useCongressMemberships, useLegislativeAccountabilityAvailability } from '../../features/congress/useCongressMemberships'

const PROFILE_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'accomplishments', label: 'Accomplishments' },
  { id: 'accountability', label: 'Accountability' },
  { id: 'legislation', label: 'Legislation' },
]

export function MobileProfile({
  politicianId,
  politicians = [],
  onAddContribution,
  onPoliticianUpdate,
  onReload,
  dbUser,
  token,
  user,
  politiciansState,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [timeline, setTimeline] = useState(null)
  const citationReviews = useCitationReviews(politicianId)

  const profile = politicians.find(p => p.politicianId === politicianId)
  const executive = profile && matchesBranch(profile, 'EXECUTIVE')
  const congressHistory = useCongressMemberships(executive ? politicianId : null)
  const hasLegislativeAccountability = useLegislativeAccountabilityAvailability(executive ? politicianId : null)
  const showCongressHistory = !executive || congressHistory.memberships.length > 0 || congressHistory.authoredCount > 0
  const isAdmin = dbUser?.role === 'ADMIN'
  const tabs = PROFILE_TABS.filter(tab => tab.id !== 'legislation' || showCongressHistory || isAdmin || hasLegislativeAccountability)
  const visibleTab = tabs.some(tab => tab.id === activeTab) ? activeTab : 'overview'

  useEffect(() => {
    if (!politicianId || activeTab !== 'accountability') return undefined
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/api/politicians/${encodeURIComponent(politicianId)}/dashboard`, { signal: controller.signal })
      .then(readApiResponse)
      .then(data => {
        if (!controller.signal.aborted) setTimeline({
          politicianId, entries: accountabilityRecords(data.publishedTimelineLedger || data.timeline || data.entries || []),
        })
      }).catch(error => {
        if (!controller.signal.aborted) setTimeline({ politicianId, error: error.message })
      })
    return () => controller.abort()
  }, [activeTab, politicianId])

  if (!profile) {
    return politiciansState?.status === 'idle' || politiciansState?.status === 'loading'
      ? <LoadingSkeleton label="Loading politician profile" rows={5} />
      : <p>Politician profile unavailable.</p>
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Profile Hero Header */}
      <div className="mobileCard" style={{ padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#122a58',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '1.25rem',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {profile.profileImageUrl ? (
              <img
                src={profile.profileImageUrl}
                alt={profile.fullName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              String(profile.fullName || '').slice(0, 2).toUpperCase()
            )}
          </div>

          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <h2 style={{
              margin: '0 0 4px',
              fontSize: '1.125rem',
              fontWeight: 800,
              color: '#0F172A',
              lineHeight: 1.25,
            }}>
              {formatDisplayName(profile.fullName).name}
            </h2>

            <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
              {formatPosition(profile.position)}
              {profile.jurisdiction && ` · ${formatJurisdiction(profile.jurisdiction)}`}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #DBEAFE',
              }}>
                WGI: {formatWgiScore(profile.wgiCompositeScore ?? profile.wgiScore ?? profile.overallScore)}
              </span>
              {profile.status && (
                <span style={{
                  background: profile.status === 'ACTIVE' ? '#F0FDF4' : '#FEF2F2',
                  color: profile.status === 'ACTIVE' ? '#15803D' : '#B91C1C',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '6px',
                }}>
                  {profile.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button for Contributor */}
        {user?.role === 'ADMIN' && (
          <button
            type="button"
            className="mobileCardAction"
            onClick={() => onAddContribution?.(profile.politicianId)}
            style={{
              width: '100%',
              marginTop: '14px',
              background: '#122a58',
              color: '#ffffff',
            }}
          >
            + Add Civic Evidence
          </button>
        )}
      </div>

      {/* Segmented Sticky Sub-Navigation */}
      <MobileSegmentedTabs
        tabs={tabs}
        activeTab={visibleTab}
        onSelectTab={setActiveTab}
      />

      {/* Tab Panels */}
      <div id={`panel-${visibleTab}`} role="tabpanel" aria-labelledby={`tab-${visibleTab}`}>
        {visibleTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <MobileBudgetTracked key={politicianId} politicianId={politicianId} total={profile.trackedBudgetAllocated} />
            <div className="mobileCard" style={{ padding: '14px' }}>
              <h3>Biography</h3>
              <ProfileBiography biography={profile.biography} review={citationReviews.get(politicianId)} />
            </div>
            {showCongressHistory && <CongressMembershipSummary politicianId={politicianId} />}
          </div>
        )}

        {visibleTab === 'accomplishments' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            <AccomplishmentsSection
              politicianId={profile.politicianId}
              token={token}
              reviews={citationReviews}
            />
          </div>
        )}

        {visibleTab === 'accountability' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            {timeline?.politicianId === politicianId && timeline.error ? <p role="alert">{timeline.error}</p>
              : <AccountabilityRecords entries={timeline?.politicianId === politicianId ? timeline.entries : []}
                loading={timeline?.politicianId !== politicianId} reviews={citationReviews} />}
          </div>
        )}

        {visibleTab === 'legislation' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            {(showCongressHistory || isAdmin) && <CongressSourceSection
              politicianId={profile.politicianId}
              isAdmin={isAdmin}
              token={token}
            />}
            <LegislativeAccountabilitySection key={politicianId} politicianId={politicianId} isAdmin={isAdmin}
              token={token} preferredChamber={chamberForPosition(profile.position)?.toUpperCase()} />
            {isAdmin && token && <CongressProfilePanel politicianId={politicianId} token={token} />}
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileProfile

