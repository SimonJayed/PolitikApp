import { useState, useEffect } from 'react'
import { AlertTriangleIcon, CircleCheckIcon, CircleXIcon, FileTextIcon, FolderIcon, RefreshCwIcon, ScaleIcon, SearchIcon } from '../icons/Lucide'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export default function AdminAdjudicationTable({ token, user, onAdjudicationComplete }) {
  const [queue, setQueue] = useState([])
  const [politicians, setPoliticians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Adjudication Dialog State
  const [adjudicationTarget, setAdjudicationTarget] = useState(null)
  const [targetStatus, setTargetStatus] = useState('RESOLVED_UPHELD')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSubmittingAdjudication, setIsSubmittingAdjudication] = useState(false)
  const [adjudicationError, setAdjudicationError] = useState(null)

  // Direct Metric Curation Modal State
  const [isCurateModalOpen, setIsCurateModalOpen] = useState(false)
  const [curateForm, setCurateForm] = useState({
    politicianId: '',
    categoryTag: 'Legislation',
    actionIdentifier: 'SPONSORED_LEGISLATION',
    primarySourceUrl: '',
    impactSummary: '',
    verificationNotes: '',
    detailKey: 'legislationTitle',
    detailVal: '',
  })
  const [isCurating, setIsCurating] = useState(false)
  const [curateError, setCurateError] = useState(null)
  const [curateSuccess, setCurateSuccess] = useState(false)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  }

  useEffect(() => {
    fetchQueue()
    fetchPoliticians()
  }, [])

  async function fetchQueue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/adjudication/queue`, { headers })
      if (!res.ok) {
        throw new Error(`Failed to fetch adjudication queue (Status ${res.status})`)
      }
      const data = await res.json()
      setQueue(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error fetching queue')
    } finally {
      setLoading(false)
    }
  }

  async function fetchPoliticians() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/politicians`)
      if (res.ok) {
        const data = await res.json()
        setPoliticians(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to fetch politicians for curate modal', err)
    }
  }

  // Handle Adjudication Transition Submit
  async function handleAdjudicationSubmit(e) {
    e.preventDefault()
    if (!adjudicationTarget) return
    setAdjudicationError(null)

    if (resolutionNotes.trim().length < 10) {
      setAdjudicationError('Please enter a descriptive ruling explanation (at least 10 characters).')
      return
    }

    setIsSubmittingAdjudication(true)
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/adjudication/${adjudicationTarget.queueId}/transition`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            targetStatus,
            adminResolutionNotes: resolutionNotes.trim(),
          }),
        }
      )

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Adjudication transition failed (HTTP ${res.status})`)
      }

      setAdjudicationTarget(null)
      setResolutionNotes('')
      await fetchQueue()
      if (onAdjudicationComplete) {
        onAdjudicationComplete()
      }
    } catch (err) {
      setAdjudicationError(err.message || 'Adjudication failed')
    } finally {
      setIsSubmittingAdjudication(false)
    }
  }

  // Handle Direct Metric Curation Submit
  async function handleCurateSubmit(e) {
    e.preventDefault()
    setCurateError(null)

    if (!curateForm.politicianId) {
      setCurateError('Please select a target politician.')
      return
    }

    if (!curateForm.primarySourceUrl.startsWith('http://') && !curateForm.primarySourceUrl.startsWith('https://')) {
      setCurateError('Primary Source citation URL must begin with http:// or https://')
      return
    }

    setIsCurating(true)
    try {
      const actionDetails = {}
      if (curateForm.detailKey && curateForm.detailVal) {
        actionDetails[curateForm.detailKey] = curateForm.detailVal
      }

      const res = await fetch(`${API_BASE_URL}/api/admin/curation/metrics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          politicianId: curateForm.politicianId,
          categoryTag: curateForm.categoryTag,
          actionIdentifier: curateForm.actionIdentifier,
          actionDetails,
          impactSummary: curateForm.impactSummary.trim(),
          primarySourceUrl: curateForm.primarySourceUrl.trim(),
          verificationNotes: curateForm.verificationNotes.trim(),
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Failed to add metric (HTTP ${res.status})`)
      }

      setCurateSuccess(true)
      setTimeout(() => {
        setCurateSuccess(false)
        setIsCurateModalOpen(false)
        setCurateForm({
          politicianId: '',
          categoryTag: 'Legislation',
          actionIdentifier: 'SPONSORED_LEGISLATION',
          primarySourceUrl: '',
          impactSummary: '',
          verificationNotes: '',
          detailKey: 'legislationTitle',
          detailVal: '',
        })
        fetchQueue()
        if (onAdjudicationComplete) {
          onAdjudicationComplete()
        }
      }, 1600)
    } catch (err) {
      setCurateError(err.message || 'Error publishing metric')
    } finally {
      setIsCurating(false)
    }
  }

  // Filtering
  const filteredQueue = queue.filter((item) => {
    // Tab Filter
    if (activeTab === 'REQUESTS' && item.itemType !== 'CONTENT_REQUEST') return false
    if (activeTab === 'CHALLENGES' && item.itemType !== 'PUBLIC_CHALLENGE') return false
    if (activeTab === 'UNDER_REVIEW' && item.queueStatus !== 'UNDER_REVIEW') return false
    if (activeTab === 'RESOLVED' && !['RESOLVED_UPHELD', 'RESOLVED_DISMISSED'].includes(item.queueStatus)) return false

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const pol = (item.politicianName || '').toLowerCase()
      const sum = (item.summary || '').toLowerCase()
      const reason = (item.challengeReason || '').toLowerCase()
      const tag = (item.categoryTag || '').toLowerCase()
      if (!pol.includes(q) && !sum.includes(q) && !reason.includes(q) && !tag.includes(q)) {
        return false
      }
    }
    return true
  })

  const counts = {
    all: queue.length,
    requests: queue.filter((i) => i.itemType === 'CONTENT_REQUEST').length,
    challenges: queue.filter((i) => i.itemType === 'PUBLIC_CHALLENGE').length,
    underReview: queue.filter((i) => i.queueStatus === 'UNDER_REVIEW').length,
    resolved: queue.filter((i) => ['RESOLVED_UPHELD', 'RESOLVED_DISMISSED'].includes(i.queueStatus)).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Console Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ScaleIcon size={20} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Admin-Curator Adjudication Console
            </h2>
            <span
              style={{
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '11px',
                fontWeight: '600',
              }}
            >
              Centralized Pipeline
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Evidence-based adjudication replacing crowd jury consensus. Primary sources are verified before updating WGI scores.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsCurateModalOpen(true)}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
          >
            <span>+</span> Direct Add Verified Metric
          </button>
          <button
            onClick={fetchQueue}
            disabled={loading}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : <><RefreshCwIcon size={14} /> Refresh Queue</>}
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          {[
            { key: 'ALL', label: 'All Items', count: counts.all },
            { key: 'CHALLENGES', label: 'Public Challenges', count: counts.challenges },
            { key: 'REQUESTS', label: 'Content Requests', count: counts.requests },
            { key: 'UNDER_REVIEW', label: 'Under Review', count: counts.underReview },
            { key: 'RESOLVED', label: 'Resolved Rulings', count: counts.resolved },
          ].map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0f172a' : '#64748b',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '12px',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 150ms ease',
                }}
              >
                {tab.label}
                <span
                  style={{
                    background: isActive ? '#f1f5f9' : '#e2e8f0',
                    color: isActive ? '#0f172a' : '#64748b',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '10px',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ minWidth: '240px' }}>
          <input
            type="text"
            placeholder="Search by politician or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Queue Items Deck */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading adjudication queue...
        </div>
      ) : error ? (
        <div
          style={{
            padding: '20px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      ) : filteredQueue.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <FolderIcon size={32} style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b' }}>
            No queue records matching this view
          </h4>
          <p style={{ margin: 0, fontSize: '13px' }}>
            Citizen requests and public challenges will appear here for administrative ruling.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredQueue.map((item) => {
            const isChallenge = item.itemType === 'PUBLIC_CHALLENGE'
            const isResolved = ['RESOLVED_UPHELD', 'RESOLVED_DISMISSED'].includes(item.queueStatus)

            const statusColors = {
              SUBMITTED_REQUEST: { bg: '#e0f2fe', text: '#0284c7', label: 'SUBMITTED REQUEST' },
              CHALLENGE_OPEN: { bg: '#fee2e2', text: '#dc2626', label: 'CHALLENGE OPEN' },
              UNDER_REVIEW: { bg: '#fef3c7', text: '#d97706', label: 'UNDER REVIEW' },
              RESOLVED_UPHELD: { bg: '#dcfce7', text: '#15803d', label: 'RESOLVED UPHELD' },
              RESOLVED_DISMISSED: { bg: '#f1f5f9', text: '#64748b', label: 'RESOLVED DISMISSED' },
            }
            const statusConfig = statusColors[item.queueStatus] || statusColors.SUBMITTED_REQUEST

            return (
              <div
                key={item.queueId}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: isChallenge ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)',
                  overflow: 'hidden',
                  transition: 'all 200ms ease',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    background: isChallenge ? '#fff5f5' : '#fafafa',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        background: isChallenge ? '#ef4444' : '#0284c7',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {isChallenge ? <><AlertTriangleIcon size={13} /> PUBLIC CHALLENGE</> : <><FileTextIcon size={13} /> CONTENT REQUEST</>}
                    </span>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                      {item.politicianName}
                    </strong>
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        background: '#e2e8f0',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {item.categoryTag}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        background: statusConfig.bg,
                        color: statusConfig.text,
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      {statusConfig.label}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={{ padding: '20px' }}>
                  {/* Summary / Metric */}
                  <div style={{ marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      Metric / Item Description
                    </span>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
                      {item.summary || 'Item under adjudication'}
                    </p>
                  </div>

                  {/* Public Challenge Ground Box */}
                  {isChallenge && item.challengeReason && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fee2e2',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '14px',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#b91c1c', textTransform: 'uppercase' }}>
                        Citizen Ground for Challenge:
                      </span>
                      <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#991b1b', lineHeight: '1.4' }}>
                        {item.challengeReason}
                      </p>
                    </div>
                  )}

                  {/* Cited Evidence / Primary Source */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      padding: '12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    {item.primarySourceUrl && (
                      <div>
                        <span style={{ color: '#64748b', fontWeight: '600' }}>Primary Source: </span>
                        <a
                          href={item.primarySourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '500' }}
                        >
                          {item.primarySourceUrl} ↗
                        </a>
                      </div>
                    )}
                    {item.evidenceUrl && (
                      <div>
                        <span style={{ color: '#b91c1c', fontWeight: '600' }}>Dispute Evidence: </span>
                        <a
                          href={item.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#dc2626', textDecoration: 'none', fontWeight: '500' }}
                        >
                          {item.evidenceUrl} ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Past Ruling / Notes if Present */}
                  {item.adminResolutionNotes && (
                    <div
                      style={{
                        background: isResolved ? '#f0fdf4' : '#fffbeb',
                        border: isResolved ? '1px solid #bbf7d0' : '1px solid #fef3c7',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        marginBottom: '14px',
                        color: isResolved ? '#166534' : '#92400e',
                      }}
                    >
                      <strong>Curator Ruling Notes:</strong> {item.adminResolutionNotes}
                      {item.resolvedAt && (
                        <span style={{ marginLeft: '8px', opacity: 0.8 }}>
                          (Resolved on {new Date(item.resolvedAt).toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Controls for Admin */}
                  {!isResolved && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        marginTop: '10px',
                        paddingTop: '14px',
                        borderTop: '1px solid #f1f5f9',
                      }}
                    >
                      {item.queueStatus !== 'UNDER_REVIEW' && (
                        <button
                          onClick={() => {
                            setAdjudicationTarget(item)
                            setTargetStatus('UNDER_REVIEW')
                            setResolutionNotes('Initiating evidence investigation with official primary sources.')
                          }}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: '1px solid #f59e0b',
                            background: '#fffbeb',
                            color: '#b45309',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          <><SearchIcon size={14} /> Mark Under Review</>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setAdjudicationTarget(item)
                          setTargetStatus('RESOLVED_UPHELD')
                          setResolutionNotes(
                            isChallenge
                              ? 'Upheld challenge: Discrepancy verified against COA/official record. Target record hidden.'
                              : 'Upheld content proposal: Verified primary source citation. Record published to live ledger.'
                          )
                        }}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <><CircleCheckIcon size={14} /> {isChallenge ? 'Uphold Challenge (Hide Invalid Metric)' : 'Approve & Publish Metric'}</>
                      </button>

                      <button
                        onClick={() => {
                          setAdjudicationTarget(item)
                          setTargetStatus('RESOLVED_DISMISSED')
                          setResolutionNotes(
                            isChallenge
                              ? 'Challenge dismissed: Primary source confirms accuracy of existing published record.'
                              : 'Content request dismissed: Unable to verify citation with primary authority records.'
                          )
                        }}
                        style={{
                          padding: '7px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#64748b',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <><CircleXIcon size={14} /> Dismiss</>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Adjudication Ruling Dialog Modal */}
      {adjudicationTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => !isSubmittingAdjudication && setAdjudicationTarget(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
              Confirm Administrative Ruling
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              Transitioning <strong>{adjudicationTarget.politicianName}</strong> item to{' '}
              <span
                style={{
                  fontWeight: '700',
                  color: targetStatus === 'RESOLVED_UPHELD' ? '#16a34a' : targetStatus === 'UNDER_REVIEW' ? '#d97706' : '#dc2626',
                }}
              >
                {targetStatus}
              </span>
            </p>

            <form onSubmit={handleAdjudicationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Target Ruling Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  <option value="UNDER_REVIEW">UNDER_REVIEW (Active Investigation)</option>
                  <option value="RESOLVED_UPHELD">RESOLVED_UPHELD (Accept Proposal / Challenge)</option>
                  <option value="RESOLVED_DISMISSED">RESOLVED_DISMISSED (Reject / Dismiss)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Administrative Ruling Explanation / Notes <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the verified evidence, citations consulted, and rationale for this ruling..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {adjudicationError && (
                <div
                  style={{
                    padding: '10px 12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '12px',
                  }}
                >
                  {adjudicationError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={isSubmittingAdjudication}
                  onClick={() => setAdjudicationTarget(null)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjudication}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isSubmittingAdjudication ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingAdjudication ? 'Processing Ruling...' : 'Execute Adjudication Ruling'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Add Verified Metric Modal */}
      {isCurateModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={() => !isCurating && setIsCurateModalOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                  Direct Admin Metric Curation
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Directly publish verified bills, projects, or COA findings with instant deterministic WGI update.
                </p>
              </div>
              <button
                onClick={() => setIsCurateModalOpen(false)}
                disabled={isCurating}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <CircleXIcon size={20} />
              </button>
            </div>

            {curateSuccess ? (
              <div style={{ padding: '30px', textAlign: 'center', background: '#f0fdf4', borderRadius: '10px' }}>
                <CircleCheckIcon size={36} style={{ marginBottom: '8px' }} />
                <h4 style={{ margin: '0 0 4px 0', color: '#166534', fontSize: '16px' }}>
                  Metric Directly Published!
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#15803d' }}>
                  WGI composite score and timeline ledger updated in real-time.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCurateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Select Politician <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    required
                    value={curateForm.politicianId}
                    onChange={(e) => setCurateForm({ ...curateForm, politicianId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  >
                    <option value="">— Choose a Politician —</option>
                    {politicians.map((p) => (
                      <option key={p.politicianId} value={p.politicianId}>
                        {p.fullName} ({p.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Category Tag
                    </label>
                    <select
                      value={curateForm.categoryTag}
                      onChange={(e) => setCurateForm({ ...curateForm, categoryTag: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="Legislation">Legislation</option>
                      <option value="Infrastructure">Infrastructure</option>
                      <option value="Finance">Finance</option>
                      <option value="Audit">Audit</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      Action Identifier
                    </label>
                    <select
                      value={curateForm.actionIdentifier}
                      onChange={(e) => {
                        const val = e.target.value
                        let defaultKey = 'legislationTitle'
                        if (val === 'PROJECT_COMPLETION') defaultKey = 'projectName'
                        if (val === 'BUDGET_ALLOCATION') defaultKey = 'allocationAmount'
                        if (val === 'COA_FINDING') defaultKey = 'flaggedAmount'
                        setCurateForm({ ...curateForm, actionIdentifier: val, detailKey: defaultKey, detailVal: '' })
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      <option value="SPONSORED_LEGISLATION">SPONSORED_LEGISLATION (Bills)</option>
                      <option value="PROJECT_COMPLETION">PROJECT_COMPLETION (Projects)</option>
                      <option value="BUDGET_ALLOCATION">BUDGET_ALLOCATION (Finance)</option>
                      <option value="COA_FINDING">COA_FINDING (Audit Discrepancy)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Detail Value ({curateForm.detailKey})
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      curateForm.actionIdentifier === 'SPONSORED_LEGISLATION'
                        ? 'e.g. Magna Carta for Barangay Workers'
                        : curateForm.actionIdentifier === 'PROJECT_COMPLETION'
                        ? 'e.g. Pasig Flood Control Hub'
                        : 'e.g. 50000000'
                    }
                    value={curateForm.detailVal}
                    onChange={(e) => setCurateForm({ ...curateForm, detailVal: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Mandatory Primary Source Citation URL <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://senate.gov.ph/... or https://coa.gov.ph/..."
                    value={curateForm.primarySourceUrl}
                    onChange={(e) => setCurateForm({ ...curateForm, primarySourceUrl: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Impact Summary Description <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Summary of the legislation, project, or audit finding..."
                    value={curateForm.impactSummary}
                    onChange={(e) => setCurateForm({ ...curateForm, impactSummary: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Curator Verification Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cross-referenced with Commission on Audit 2024 Executive Summary"
                    value={curateForm.verificationNotes}
                    onChange={(e) => setCurateForm({ ...curateForm, verificationNotes: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                {curateError && (
                  <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '12px' }}>
                    {curateError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    disabled={isCurating}
                    onClick={() => setIsCurateModalOpen(false)}
                    style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCurating}
                    style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#0284c7', color: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: isCurating ? 'not-allowed' : 'pointer' }}
                  >
                    {isCurating ? 'Publishing...' : 'Directly Publish Metric'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
