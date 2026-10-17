import { useEffect, useState } from 'react'
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext'
import AdminAdjudicationTable from './module2/AdminAdjudicationTable'
import './module2/Module2.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export default function ModerationPanel({ token, user }) {
  const sandboxContext = useDeveloperSandbox() || {}
  const isDevModeActive = sandboxContext.isDevModeActive || false
  const manipulatedUser = sandboxContext.manipulatedUser || null

  // Determine effective user role
  const effectiveRole = isDevModeActive && manipulatedUser?.role ? manipulatedUser.role : user?.role || 'CONTRIBUTOR'
  const isAdmin = effectiveRole === 'ADMIN' || effectiveRole === 'ADMINISTRATOR'

  // Citizen view state
  const [citizenItems, setCitizenItems] = useState([])
  const [citizenLoading, setCitizenLoading] = useState(false)
  const [citizenError, setCitizenError] = useState(null)

  const effectiveToken = token || localStorage.getItem('token') || localStorage.getItem('jwt')

  useEffect(() => {
    if (!isAdmin) {
      fetchCitizenHistory()
    }
  }, [isAdmin, effectiveToken])

  async function fetchCitizenHistory() {
    setCitizenLoading(true)
    setCitizenError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions`, {
        headers: {
          Authorization: effectiveToken ? `Bearer ${effectiveToken}` : '',
        },
      })
      if (res.ok) {
        const data = await res.json()
        setCitizenItems(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Error fetching citizen submissions:', err)
      setCitizenError('Unable to load submission history.')
    } finally {
      setCitizenLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* Role Banner */}
      <div
        style={{
          background: isAdmin ? '#f0f9ff' : '#fafafa',
          border: `1px solid ${isAdmin ? '#bae6fd' : '#e2e8f0'}`,
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{isAdmin ? '🛡️' : '👥'}</span>
            <strong style={{ fontSize: '14px', color: '#0f172a' }}>
              {isAdmin ? 'Admin Curator Console' : 'Citizen Dispute & Request Pipeline'}
            </strong>
            <span
              style={{
                background: isAdmin ? '#0284c7' : '#64748b',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '10px',
                fontWeight: '700',
              }}
            >
              {effectiveRole}
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
            {isAdmin
              ? 'You have administrative authority to directly curate metrics and adjudicate citizen challenges.'
              : 'Community peer voting has been deprecated in favor of evidence-based Admin Curation and Public Disputes.'}
          </p>
        </div>

        {!isAdmin && (
          <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: '500' }}>
            Evidence Citations Mandatory
          </span>
        )}
      </div>

      {/* Main Panel Content */}
      {isAdmin ? (
        <AdminAdjudicationTable token={effectiveToken} user={user} onAdjudicationComplete={() => {}} />
      ) : (
        /* Citizen-Facing View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Informational Hero Card */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
              How the Evidence-Based Curation Model Works
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
              PolitikApp operates on a centralized, evidence-verified model to guarantee high integrity for public servant performance records. Crowd peer voting and reviewer consensus thresholds have been replaced with direct primary-source verification.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div
                style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>📝</div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                  1. Propose New Metrics
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  Submit bills, completed infrastructure projects, or audit findings with verifiable government links via the <strong>Propose Metric</strong> form.
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>⚖️</div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                  2. Dispute Inaccurate Records
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  Found an improperly attributed bill, stalled project, or audit discrepancy? Click <strong>Challenge Record</strong> on any timeline item to submit counter-evidence.
                </p>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>🛡️</div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                  3. Admin Curator Ruling
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  Admin Curators investigate citations directly. Upheld proposals publish to the live ledger, while upheld challenges archive inaccurate records and update WGI scores.
                </p>
              </div>
            </div>
          </div>

          {/* Citizen Recent Activity / Submissions */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                Your Metric Proposals & Dispute Requests
              </h4>
              <button
                onClick={fetchCitizenHistory}
                disabled={citizenLoading}
                style={{
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                {citizenLoading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>

            {citizenLoading ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>Fetching records...</p>
            ) : citizenItems.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  color: '#64748b',
                }}
              >
                <p style={{ margin: '0 0 6px 0', fontSize: '13px' }}>
                  You haven&apos;t filed any metric proposals or challenges yet.
                </p>
                <small style={{ color: '#94a3b8' }}>
                  Explore politician profiles to propose records or dispute existing timeline items.
                </small>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {citizenItems.map((item) => (
                  <div
                    key={item.submissionId}
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#fafafa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px', color: '#1e293b' }}>
                        {item.impactSummary || 'Submitted Request'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        Category: {item.categoryTag} | Tag: {item.actionIdentifier}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background:
                          item.status === 'PUBLISHED' || item.status === 'RESOLVED_UPHELD'
                            ? '#dcfce7'
                            : item.status === 'UNDER_REVIEW'
                            ? '#fef3c7'
                            : item.status === 'RESOLVED_DISMISSED'
                            ? '#fee2e2'
                            : '#e0f2fe',
                        color:
                          item.status === 'PUBLISHED' || item.status === 'RESOLVED_UPHELD'
                            ? '#15803d'
                            : item.status === 'UNDER_REVIEW'
                            ? '#d97706'
                            : item.status === 'RESOLVED_DISMISSED'
                            ? '#dc2626'
                            : '#0284c7',
                      }}
                    >
                      {item.status || 'SUBMITTED_REQUEST'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
