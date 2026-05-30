import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';
import TrustScoreMeter from './TrustScoreMeter';
import { clampTrustScore } from './trustScore';
import ContributorPenaltyDashboard from './module3/ContributorPenaltyDashboard';
import PeerVotingWeightDashboard from './module3/PeerVotingWeightDashboard';
import './module3/Module3.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function resolveAuditorTier(trustScore) {
  if (trustScore >= 400) {
    return { label: 'Civic Prime Auditor', weight: 5, tone: 'elite' };
  }
  if (trustScore >= 250) {
    return { label: 'Senior Auditor', weight: 3, tone: 'senior' };
  }
  if (trustScore >= 150) {
    return { label: 'Trusted Auditor', weight: 2, tone: 'senior' };
  }
  return { label: 'Baseline Auditor', weight: 1, tone: 'standard' };
}

function roleDescriptor(role) {
  if (role === 'CONTRIBUTOR') {
    return 'The Ingestion Node';
  }
  if (role === 'ADMINISTRATOR' || role === 'ADMIN') {
    return 'The System Overseer';
  }
  return 'The Auditor Node';
}

async function readApiResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }
  return payload;
}

export default function UserProfileMatrixPanel({ token, user }) {
  const sandbox = useDeveloperSandbox() || {};
  const {
    isDevModeActive,
    manipulatedUser,
    profileMetrics,
    contributorRejectionRate = 0,
    simulateApprovedSubmission,
    simulateRejectedSubmission,
    simulateConsensusVote,
    simulateDissentVote,
  } = sandbox;

  const actor = isDevModeActive && manipulatedUser ? manipulatedUser : user;
  const activeRole = actor?.role || 'JUDICIAL_REVIEWER';
  const trustScore = clampTrustScore(actor?.trustScore ?? 100);
  const descriptor = roleDescriptor(activeRole);
  const auditorTier = resolveAuditorTier(trustScore);

  // Dynamic profile metrics state for standard (non-sandbox) mode
  const [dynamicMetrics, setDynamicMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isDevModeActive) {
      setDynamicMetrics(null);
      return;
    }

    if (!actor?.userId) return;

    let ignore = false;
    setLoading(true);

    const loadData = async () => {
      try {
        if (activeRole === 'CONTRIBUTOR') {
          const resSub = await fetch(`${API_BASE_URL}/api/submissions/contributor/${actor.userId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const submissionsData = await readApiResponse(resSub);
          if (ignore) return;

          const entries = Array.isArray(submissionsData) ? submissionsData : [];
          const submissions = entries.length;
          const approved = entries.filter((e) => e.status === 'PUBLISHED').length;
          const rejected = entries.filter((e) => e.status === 'REJECTED').length;

          setDynamicMetrics({
            contributorSubmissions: submissions,
            contributorApproved: approved,
            contributorRejected: rejected,
          });
        } else if (activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN') {
          const adminMetrics = actor?.sandboxProfileMetrics || {};
          setDynamicMetrics({
            adminInterventions: adminMetrics.adminInterventions ?? 7,
            adminTieBreakerActive: adminMetrics.adminTieBreakerActive ?? true,
            adminTimeoutOverrideActive: adminMetrics.adminTimeoutOverrideActive ?? true,
          });
        } else {
          // Reviewer / Peer role
          const resWeight = await fetch(`${API_BASE_URL}/api/module3/peers/${actor.userId}/vote-weight`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const weightData = await readApiResponse(resWeight);

          const resArchive = await fetch(`${API_BASE_URL}/api/moderation/archive`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const archiveData = await readApiResponse(resArchive);
          if (ignore) return;

          const ballotEntries = Array.isArray(archiveData) ? archiveData : [];
          const totalBallots = ballotEntries.length;
          const consensusVotes = ballotEntries.filter((e) => {
            const isTerminal = e.status === 'PUBLISHED' || e.status === 'REJECTED';
            const isAligned = (e.userVote === 'AGREE' && e.status === 'PUBLISHED') ||
              (e.userVote === 'DISAGREE' && e.status === 'REJECTED');
            return isTerminal && isAligned;
          }).length;
          const dissentVotes = ballotEntries.filter((e) => {
            const isTerminal = e.status === 'PUBLISHED' || e.status === 'REJECTED';
            const isAligned = (e.userVote === 'AGREE' && e.status === 'PUBLISHED') ||
              (e.userVote === 'DISAGREE' && e.status === 'REJECTED');
            return isTerminal && !isAligned;
          }).length;

          setDynamicMetrics({
            reviewerTotalBallots: totalBallots,
            reviewerConsensusVotes: consensusVotes,
            reviewerDissentVotes: dissentVotes,
            voteWeight: weightData.voteWeight ?? 1,
            historicalPrecision: weightData.historicalPrecision ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to fetch live profile metrics:", err);
        if (!ignore) {
          setError(err.message || "Failed to fetch live profile metrics.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, [isDevModeActive, actor?.userId, activeRole, token]);

  const activeMetrics = isDevModeActive ? profileMetrics : dynamicMetrics;

  const dynamicRejectionRate = activeMetrics?.contributorSubmissions > 0
    ? (activeMetrics.contributorRejected / activeMetrics.contributorSubmissions) * 100
    : 0;

  const rejectionRate = isDevModeActive ? contributorRejectionRate : dynamicRejectionRate;

  const rejectionLocked = isDevModeActive
    ? (contributorRejectionRate > 15)
    : (actor?.status === 'LOCKED' || actor?.accountStatus === 'LOCKED' || (activeMetrics?.contributorSubmissions >= 5 && rejectionRate > 15));

  const consensusRate = isDevModeActive
    ? (profileMetrics?.reviewerTotalBallots > 0
      ? (profileMetrics.reviewerConsensusVotes / profileMetrics.reviewerTotalBallots) * 100
      : 0)
    : (activeMetrics?.historicalPrecision ?? 0);

  const headerTone = useMemo(() => {
    if (activeRole === 'CONTRIBUTOR') return 'matrixHero contributor';
    if (activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN') return 'matrixHero admin';
    return 'matrixHero reviewer';
  }, [activeRole]);

  if (!activeMetrics) {
    if (loading) {
      return (
        <section className="workspace profileMatrixWorkspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ledgerEmptyState">Loading dynamic profile metrics...</div>
        </section>
      );
    }
    return null;
  }

  return (
    <section className="workspace profileMatrixWorkspace">
      <header className={headerTone}>
        <div>
          <span className="matrixRoleBadge">{activeRole}</span>
          <h2 className="ty-section-title">{descriptor}</h2>
          <p className="ty-body">{actor?.name || actor?.fullName || 'Sandbox Actor'} is mapped to a live role metrics matrix.</p>
        </div>
        <div className="matrixHeroScore">
          {activeRole !== 'ADMINISTRATOR' && activeRole !== 'ADMIN' && (
            <TrustScoreMeter score={trustScore} showEligibility={true} variant="compact" />
          )}
          <small>{actor?.status || actor?.accountStatus || 'ACTIVE'}</small>
        </div>
      </header>

      {/* Contributor Matrix Layout */}
      {activeRole === 'CONTRIBUTOR' && (
        <ContributorPenaltyDashboard
          isSandboxMode={isDevModeActive}
          metrics={activeMetrics}
          rejectionLocked={rejectionLocked}
          rejectionRate={rejectionRate}
          simulateApprovedSubmission={simulateApprovedSubmission}
          simulateRejectedSubmission={simulateRejectedSubmission}
          token={token}
          user={actor}
        />
      )}

      {/* Reviewer Matrix Layout */}
      {activeRole !== 'CONTRIBUTOR' && activeRole !== 'ADMINISTRATOR' && activeRole !== 'ADMIN' && (
        <PeerVotingWeightDashboard
          consensusRate={consensusRate}
          metrics={activeMetrics}
          simulateConsensusVote={simulateConsensusVote}
          simulateDissentVote={simulateDissentVote}
          tier={auditorTier}
          trustScore={trustScore}
          isSandboxMode={isDevModeActive}
          token={token}
          user={actor}
        />
      )}

      {/* Admin Matrix Layout */}
      {(activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN') && (
        <AdminMatrix
          metrics={activeMetrics}
          token={token}
        />
      )}
    </section>
  );
}

function AdminMatrix({ metrics, token }) {
  const [pendingApps, setPendingApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPending = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/peer-applications/admin/pending`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        setPendingApps(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load applications.');
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAction = async (applicationId, action) => {
    const originalPending = [...pendingApps];
    setPendingApps(pendingApps.filter(app => app.applicationId !== applicationId));

    try {
      const res = await fetch(`${API_BASE_URL}/api/peer-applications/admin/${applicationId}/${action}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Action failed.');
      }
      fetchPending();
    } catch (err) {
      console.error(err);
      setPendingApps(originalPending);
      alert('Failed to process administrative action: ' + err.message);
    }
  };

  return (
    <>
      <section className="matrixCardGrid">
        <MetricCard label="Credential" value="ADMINISTRATOR" tone="admin" />
        <MetricCard label="Intervention Count" value={metrics.adminInterventions} />
        <MetricCard label="50-50 Tie Breaker" value={metrics.adminTieBreakerActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTieBreakerActive ? 'success' : 'danger'} />
        <MetricCard label="24-Hour Timeout Override" value={metrics.adminTimeoutOverrideActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTimeoutOverrideActive ? 'success' : 'danger'} />
      </section>

      {/* Admin Verification Desk */}
      <section className="matrixActionPanel" style={{ marginTop: '24px', background: 'var(--bg-surface)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <header style={{ borderBottom: '1px solid var(--line-hairline)', paddingBottom: '12px', marginBottom: '20px' }}>
          <h3 className="ty-card-title" style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>💼 Peer Verification Desk</h3>
          <p className="ty-meta" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Review pending applications from trusted community members applying for Peer Reviewer credentials.
          </p>
        </header>

        {loading && pendingApps.length === 0 ? (
          <div className="ledgerEmptyState">Loading verification queue...</div>
        ) : error ? (
          <div className="ledgerEmptyState" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : pendingApps.length === 0 ? (
          <div className="ledgerEmptyState">No pending peer verification applications at this time.</div>
        ) : (
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {pendingApps.map((app) => (
              <article key={app.applicationId} style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid var(--line-soft)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--ph-gold)', background: 'rgba(217,119,6,0.1)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(217,119,6,0.15)' }}>
                      {app.organizationType}
                    </span>
                    <h4 style={{ margin: '8px 0 2px', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                      Contributor Applicant
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-subtle)', fontFamily: 'var(--mono, monospace)' }}>
                      {app.contributorId.slice(0, 8)}...
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'grid', gap: '4px' }}>
                  <div><strong>Institutional Email:</strong> {app.institutionalEmail}</div>
                  <div><strong>Verification Proof:</strong> <a href={app.verificationProofUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', textDecoration: 'underline' }}>View Proof Document ↗</a></div>
                </div>

                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.015)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--line-soft)',
                  fontSize: '12px',
                  color: 'var(--text-subtle)',
                  fontStyle: 'italic',
                  lineHeight: '1.5'
                }}>
                  &ldquo;{app.justificationStatement}&rdquo;
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <button
                    onClick={() => handleAction(app.applicationId, 'approve')}
                    type="button"
                    style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleAction(app.applicationId, 'reject')}
                    className="dangerButton"
                    type="button"
                    style={{ border: 'none', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✕ Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function MetricCard({ label, tone = 'neutral', value }) {
  return (
    <article className={`matrixMetricCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
