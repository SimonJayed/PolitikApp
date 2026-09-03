import { useState } from 'react'

export default function ChallengeRecordModal({
  isOpen,
  onClose,
  targetRecord,
  onChallengeSubmitted
}) {
  const [challengeReason, setChallengeReason] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen || !targetRecord) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const trimmedReason = challengeReason.trim()
    const trimmedEvidence = evidenceUrl.trim()

    if (trimmedReason.length < 15) {
      setError('Please provide a specific dispute reason (at least 15 characters).')
      return
    }

    if (!trimmedEvidence.startsWith('http://') && !trimmedEvidence.startsWith('https://')) {
      setError('Evidence citation URL must start with http:// or https://')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('jwt')
      const headers = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          challengeTargetId: targetRecord.timelineId,
          politicianId: targetRecord.politicianId,
          challengeReason: trimmedReason,
          evidenceUrl: trimmedEvidence,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to submit challenge (Status ${res.status})`)
      }

      const data = await res.json()
      setSuccess(true)
      if (onChallengeSubmitted) {
        onChallengeSubmitted(data)
      }
      setTimeout(() => {
        setSuccess(false)
        setChallengeReason('')
        setEvidenceUrl('')
        onClose()
      }, 2200)
    } catch (err) {
      setError(err.message || 'An unexpected error occurred while submitting dispute.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '560px',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
              }}
            >
              ⚠️
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Challenge / Dispute Metric Record
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Citizen Evidence Verification Pipeline
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {success ? (
            <div
              style={{
                padding: '28px 20px',
                textAlign: 'center',
                background: '#ecfdf5',
                borderRadius: '10px',
                border: '1px solid #a7f3d0',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>✅</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#065f46' }}>
                Dispute Submitted to Admin Curator
              </h4>
              <p style={{ margin: 0, fontSize: '13px', color: '#047857' }}>
                Your challenge has been registered with status <strong>CHALLENGE_OPEN</strong>. An Admin Curator will review your cited primary source.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Target Record Card */}
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>
                    Challenged Record
                  </span>
                  <span
                    style={{
                      background: '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {targetRecord.categoryTag || 'Ledger Item'}
                  </span>
                </div>
                <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                  {targetRecord.summary || 'Selected Metric'}
                </div>
                {targetRecord.sourceUrl && (
                  <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all' }}>
                    Current Citation: <span style={{ textDecoration: 'underline' }}>{targetRecord.sourceUrl}</span>
                  </div>
                )}
              </div>

              {/* Citizen Guidance Notice */}
              <div
                style={{
                  fontSize: '12px',
                  color: '#475569',
                  background: '#eff6ff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  lineHeight: '1.5',
                }}
              >
                💡 <strong>Dispute Ground Rules:</strong> Citations must point to primary records (e.g. Commission on Audit reports, legislative journals, official gazettes, or accredited investigative findings).
              </div>

              {/* Dispute Ground Field */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                  Ground for Challenge / Discrepancy Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why this metric is inaccurate, delayed, improperly attributed, or contradicts official audit findings..."
                  value={challengeReason}
                  onChange={(e) => setChallengeReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Primary Evidence URL */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                  Supporting Evidence Primary Source URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://coa.gov.ph/reports/... or https://senate.gov.ph/..."
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '12px',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {loading ? 'Submitting Dispute...' : 'File Public Challenge'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
