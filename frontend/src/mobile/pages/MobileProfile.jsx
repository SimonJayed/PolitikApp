import { useEffect, useState } from 'react'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { formatDisplayName } from '../../features/congress/displayName'
import { formatWgiScore } from '../../features/congress/wgiLeaderboard'
import CongressProfilePanel from '../../components/governance/CongressProfilePanel'
import CongressSourceSection from '../../components/governance/CongressSourceSection'
import AccomplishmentsSection from '../../components/governance/AccomplishmentsSection'
import AccountabilityRecords from '../../components/governance/AccountabilityRecords'
import CongressMembershipSummary from '../../components/governance/CongressMembershipSummary'
import MobileSegmentedTabs from '../components/tabs/MobileSegmentedTabs'
import { API_BASE_URL, readApiResponse } from '../../api/client'
import { congressRequest } from '../../api/congress'

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
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [congressData, setCongressData] = useState(null)
  const [loadingCongress, setLoadingCongress] = useState(true)

  const profile = politicians.find((p) => p.politicianId === politicianId) || {
    politicianId,
    fullName: 'Loading...',
    position: 'OFFICIAL',
    jurisdiction: 'NATIONAL',
  }

  useEffect(() => {
    let cancelled = false
    if (!politicianId) return

    setLoadingCongress(true)
    congressRequest(politicianId)
      .then((data) => {
        if (!cancelled) setCongressData(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingCongress(false)
      })

    return () => {
      cancelled = true
    }
  }, [politicianId])

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
              {formatDisplayName(profile.fullName)}
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
                WGI: {formatWgiScore(profile.wgiScore || profile.overallScore)}
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
        tabs={PROFILE_TABS}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Tab Panels */}
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CongressMembershipSummary
              memberships={congressData?.memberships || []}
            />
            <CongressProfilePanel
              profile={profile}
              congressData={congressData}
              loading={loadingCongress}
            />
          </div>
        )}

        {activeTab === 'accomplishments' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            <AccomplishmentsSection
              politicianId={profile.politicianId}
              token={token}
            />
          </div>
        )}

        {activeTab === 'accountability' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            <AccountabilityRecords
              politicianId={profile.politicianId}
              token={token}
            />
          </div>
        )}

        {activeTab === 'legislation' && (
          <div className="mobileCard" style={{ padding: '14px' }}>
            <CongressSourceSection
              politicianId={profile.politicianId}
              congressData={congressData}
              loading={loadingCongress}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default MobileProfile

