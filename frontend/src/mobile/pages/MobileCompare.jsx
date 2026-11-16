import { useState } from 'react'
import { ScaleIcon, GitCompareIcon } from '../../components/icons/Lucide'
import { formatJurisdiction, formatPosition } from '../../components/governance/positionConfig'
import { formatWgiScore } from '../../features/congress/wgiLeaderboard'
import MobileSegmentedTabs from '../components/tabs/MobileSegmentedTabs'

export function MobileCompare({
  compareIds = { idA: '', idB: '' },
  onChange,
  onSubmit,
  politicians = [],
  state = {},
}) {
  const [activeCandidateView, setActiveCandidateView] = useState('both')

  const candA = politicians.find((p) => p.politicianId === compareIds.idA)
  const candB = politicians.find((p) => p.politicianId === compareIds.idB)

  const handleSelectA = (id) => {
    onChange?.({ ...compareIds, idA: id })
  }

  const handleSelectB = (id) => {
    onChange?.({ ...compareIds, idB: id })
  }

  const canCompare = Boolean(compareIds.idA && compareIds.idB && compareIds.idA !== compareIds.idB)

  const comparison = state.data
  const matrix = comparison?.alignedHorizontalMatrix || []

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Selection Section */}
      <div className="mobileCard" style={{ padding: '16px', marginBottom: '16px' }}>
        <h2 style={{
          margin: '0 0 12px',
          fontSize: '1rem',
          fontWeight: 700,
          color: '#0F172A',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <ScaleIcon size={20} color="#2563EB" />
          <span>Compare Public Officials</span>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Candidate A
            </label>
            <select
              value={compareIds.idA || ''}
              onChange={(e) => handleSelectA(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            >
              <option value="">Select Candidate A...</option>
              {politicians.map((p) => (
                <option key={`a-${p.politicianId}`} value={p.politicianId} disabled={p.politicianId === compareIds.idB}>
                  {p.fullName} ({formatPosition(p.position) || 'Official'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Candidate B
            </label>
            <select
              value={compareIds.idB || ''}
              onChange={(e) => handleSelectB(e.target.value)}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                background: '#FFFFFF',
                color: '#0F172A',
              }}
            >
              <option value="">Select Candidate B...</option>
              {politicians.map((p) => (
                <option key={`b-${p.politicianId}`} value={p.politicianId} disabled={p.politicianId === compareIds.idA}>
                  {p.fullName} ({formatPosition(p.position) || 'Official'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="mobileCardAction"
            disabled={!canCompare || state.status === 'loading'}
            onClick={() => onSubmit?.()}
            style={{
              width: '100%',
              background: canCompare ? '#122a58' : '#94A3B8',
              color: '#ffffff',
              marginTop: '4px',
            }}
          >
            {state.status === 'loading' ? 'Loading Comparison...' : 'Compare Side-by-Side'}
          </button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div>
          {/* Side-by-side Candidate Badges */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
            marginBottom: '16px',
          }}>
            <div className="mobileCard" style={{ padding: '12px', margin: 0, textAlign: 'center' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#2563EB',
                color: '#ffffff',
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                overflow: 'hidden',
              }}>
                {candA?.profileImageUrl ? (
                  <img src={candA.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  'A'
                )}
              </div>
              <h4 style={{ margin: '0 0 2px', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                {candA?.fullName || 'Candidate A'}
              </h4>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF' }}>
                WGI: {formatWgiScore(candA?.overallScore || candA?.wgiScore)}
              </span>
            </div>

            <div className="mobileCard" style={{ padding: '12px', margin: 0, textAlign: 'center' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#7C3AED',
                color: '#ffffff',
                margin: '0 auto 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                overflow: 'hidden',
              }}>
                {candB?.profileImageUrl ? (
                  <img src={candB.profileImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  'B'
                )}
              </div>
              <h4 style={{ margin: '0 0 2px', fontSize: '0.875rem', fontWeight: 700, color: '#0F172A' }}>
                {candB?.fullName || 'Candidate B'}
              </h4>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6D28D9' }}>
                WGI: {formatWgiScore(candB?.overallScore || candB?.wgiScore)}
              </span>
            </div>
          </div>

          {/* Matrix Evidence Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {matrix.length === 0 ? (
              <div className="mobileCard" style={{ textAlign: 'center', padding: '24px' }}>
                <p style={{ margin: 0, color: '#64748B' }}>No comparative evidence records found.</p>
              </div>
            ) : (
              matrix.map((row) => (
                <div key={row.categoryTag} className="mobileCard" style={{ padding: '14px', margin: 0 }}>
                  <h4 style={{
                    margin: '0 0 10px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#1E293B',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '6px',
                  }}>
                    {row.categoryTag}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #2563EB' }}>
                      <strong style={{ display: 'block', fontSize: '0.75rem', color: '#2563EB', marginBottom: '4px' }}>
                        {candA?.fullName || 'Candidate A'} ({row.recordsA?.length || 0} records)
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155' }}>
                        {row.recordsA?.[0]?.summary || row.recordsA?.[0]?.impactSummary || 'No documented records in this category.'}
                      </p>
                    </div>

                    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', borderLeft: '3px solid #7C3AED' }}>
                      <strong style={{ display: 'block', fontSize: '0.75rem', color: '#7C3AED', marginBottom: '4px' }}>
                        {candB?.fullName || 'Candidate B'} ({row.recordsB?.length || 0} records)
                      </strong>
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: '#334155' }}>
                        {row.recordsB?.[0]?.summary || row.recordsB?.[0]?.impactSummary || 'No documented records in this category.'}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileCompare

