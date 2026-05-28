import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';
import TrustScoreMeter from './TrustScoreMeter';
import { clampTrustScore } from './trustScore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0));
}

function formatLedgerDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

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

const LEDGER_FILTER_TABS = [
  { key: 'all', label: 'ALL ENTRIES' },
  { key: 'audit', label: 'AUDIT ENTRIES' },
  { key: 'legislation', label: 'LEGISLATION ENTRIES' },
  { key: 'project', label: 'PROJECT ENTRIES' },
];

async function readApiResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }
  return payload;
}

function formatActionMetric(actionDetails, actionIdentifier) {
  if (!actionDetails) return 'N/A';

  switch (actionIdentifier) {
    case 'COA_FINDING':
      return formatCurrency(actionDetails.flaggedAmount);
    case 'BUDGET_ALLOCATION':
      return formatCurrency(actionDetails.allocationAmount);
    case 'PROJECT_COMPLETION':
      return `${Number(actionDetails.completionPercentage || 0).toLocaleString('en-PH')}% Completed`;
    case 'SPONSORED_LEGISLATION':
      return [
        actionDetails.legislationTitle,
        actionDetails.legislativeStatus,
        formatLedgerDate(actionDetails.dateFiled),
      ].filter(Boolean).join(' | ') || 'Legislation details';
    default:
      return actionDetails.metric !== undefined ? String(actionDetails.metric) : 'View Details';
  }
}

function normalizeLedgerText(value) {
  return String(value || '').toLowerCase();
}

function ledgerEntryKind(entry) {
  const searchable = [
    entry.categoryTag,
    entry.actionIdentifier,
    entry.impactSummary,
    entry.sourceUrl,
  ].map(normalizeLedgerText).join(' ');

  if (searchable.includes('audit') || searchable.includes('coa')) return 'audit';
  if (searchable.includes('project') || searchable.includes('infrastructure')) return 'project';
  if (searchable.includes('legislation') || searchable.includes('bill') || searchable.includes('ordinance')) return 'legislation';
  return 'audit';
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
    updateProfileMetric,
    adjustAdminInterventions,
  } = sandbox;

  const actor = isDevModeActive && manipulatedUser ? manipulatedUser : user;
  const activeRole = actor?.role || 'JUDICIAL_REVIEWER';
  const trustScore = clampTrustScore(actor?.trustScore ?? 100);
  const descriptor = roleDescriptor(activeRole);
  const auditorTier = resolveAuditorTier(trustScore);
  const rejectionLocked = isDevModeActive && contributorRejectionRate > 15;
  const consensusRate = profileMetrics?.reviewerTotalBallots > 0
    ? (profileMetrics.reviewerConsensusVotes / profileMetrics.reviewerTotalBallots) * 100
    : 0;

  const headerTone = useMemo(() => {
    if (activeRole === 'CONTRIBUTOR') return 'matrixHero contributor';
    if (activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN') return 'matrixHero admin';
    return 'matrixHero reviewer';
  }, [activeRole]);

  if (!profileMetrics) {
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
          <small>{actor?.status || 'ACTIVE'}</small>
        </div>
      </header>

      {/* Contributor Matrix Layout */}
      {activeRole === 'CONTRIBUTOR' && (
        <ContributorMatrix
          isSandboxMode={isDevModeActive}
          metrics={profileMetrics}
          rejectionLocked={isDevModeActive && rejectionLocked}
          rejectionRate={isDevModeActive ? contributorRejectionRate : 0}
          simulateApprovedSubmission={simulateApprovedSubmission}
          simulateRejectedSubmission={simulateRejectedSubmission}
          token={token}
          user={actor}
        />
      )}

      {/* Reviewer Matrix Layout */}
      {activeRole !== 'CONTRIBUTOR' && activeRole !== 'ADMINISTRATOR' && activeRole !== 'ADMIN' && (
        <ReviewerMatrix
          consensusRate={consensusRate}
          metrics={profileMetrics}
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
          adjustAdminInterventions={adjustAdminInterventions}
          metrics={profileMetrics}
          updateProfileMetric={updateProfileMetric}
          isSandboxMode={isDevModeActive}
          token={token}
        />
      )}
    </section>
  );
}

function ContributorMatrix({
  isSandboxMode = false,
  metrics,
  rejectionLocked,
  rejectionRate,
  simulateApprovedSubmission,
  simulateRejectedSubmission,
  token,
  user,
}) {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerState, setLedgerState] = useState({ status: 'loading', message: 'Loading ledger entries...' });
  const [applications, setApplications] = useState([]);
  const [appForm, setAppForm] = useState({
    organizationType: 'FACULTY',
    institutionalEmail: '',
    verificationProofUrl: '',
    justificationStatement: '',
  });
  const [appState, setAppState] = useState({ status: 'idle', message: '' });

  const fetchApplications = useCallback(() => {
    if (!user?.userId) return;
    fetch(`${API_BASE_URL}/api/peer-applications/my`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        setApplications(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('Failed to load peer applications:', err));
  }, [token, user?.userId]);

  useEffect(() => {
    let ignore = false;

    if (!user?.userId) {
      setLedgerEntries([]);
      setLedgerState({ status: 'error', message: 'Unable to load database ledger records without a user id.' });
      return () => {
        ignore = true;
      };
    }

    setLedgerState({ status: 'loading', message: 'Loading ledger entries...' });
    fetch(`${API_BASE_URL}/api/submissions/contributor/${user.userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        if (ignore) return;
        const entries = Array.isArray(data) ? data : [];
        setLedgerEntries(entries);
        setLedgerState({
          status: 'success',
          message: entries.length > 0 ? '' : 'No database ledger records found.',
        });
      })
      .catch((error) => {
        if (ignore) return;
        setLedgerEntries([]);
        setLedgerState({ status: 'error', message: error.message || 'Could not load database ledger records.' });
      });

    fetchApplications();

    return () => {
      ignore = true;
    };
  }, [token, user?.userId, fetchApplications]);

  const realMetrics = useMemo(() => {
    const submissions = ledgerEntries.length;
    const approved = ledgerEntries.filter((entry) => entry.status === 'PUBLISHED').length;
    const rejected = ledgerEntries.filter((entry) => entry.status === 'REJECTED').length;
    const rate = submissions > 0 ? (rejected / submissions) * 100 : 0;
    return {
      approved,
      rate,
      rejected,
      submissions,
    };
  }, [ledgerEntries]);

  const displayedMetrics = isSandboxMode
    ? {
        approved: metrics.contributorApproved,
        rate: rejectionRate,
        rejected: metrics.contributorRejected,
        submissions: metrics.contributorSubmissions,
      }
    : realMetrics;

  const pendingApp = applications.find(app => app.status === 'PENDING');
  const hasPending = !!pendingApp;

  const handleAppSubmit = async (e) => {
    e.preventDefault();
    setAppState({ status: 'loading', message: 'Submitting verification application...' });
    try {
      const data = await fetch(`${API_BASE_URL}/api/peer-applications/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(appForm),
      }).then(readApiResponse);
      setAppState({ status: 'success', message: 'Application submitted successfully! It is now pending administrative review.' });
      setAppForm({
        organizationType: 'FACULTY',
        institutionalEmail: '',
        verificationProofUrl: '',
        justificationStatement: '',
      });
      fetchApplications();
    } catch (err) {
      setAppState({ status: 'error', message: err.message || 'Submission failed.' });
    }
  };

  return (
    <>
      {rejectionLocked && (
        <section className="matrixLockoutCard">
          <strong>Automatic Contributor Lockout Active</strong>
          <span>Lifetime rejection rate is {formatPercent(rejectionRate)}. The sandbox account status has been switched to SUSPENDED.</span>
        </section>
      )}

      <section className="matrixCardGrid">
        <MetricCard label="Active Submissions" value={displayedMetrics.submissions} />
        <MetricCard label="Approved Cards" value={displayedMetrics.approved} tone="success" />
        <MetricCard label="Rejected Cards" value={displayedMetrics.rejected} tone="danger" />
        <MetricCard label="Lifetime Rejection Rate" value={formatPercent(displayedMetrics.rate)} tone={rejectionLocked ? 'danger' : 'neutral'} />
      </section>

      <LedgerFilterTabs entries={ledgerEntries} state={ledgerState} />

      {/* Peer Application Console */}
      <section className="matrixActionPanel" style={{ marginTop: '24px', background: 'var(--bg-surface)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
        <header style={{ borderBottom: '1px solid var(--line-hairline)', paddingBottom: '12px', marginBottom: '20px' }}>
          <h3 className="ty-card-title" style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>🎓 Peer Reviewer Application</h3>
          <p className="ty-meta" style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Are you a university faculty, campus journalist, researcher, or civic volunteer? Elevate your role to PEER to review other submissions.
          </p>
        </header>

        {hasPending ? (
          <div style={{
            padding: '16px 20px',
            background: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderLeft: '4px solid #d97706',
            borderRadius: 'var(--radius-md)',
            color: '#b45309',
            fontSize: '14px',
            lineHeight: '1.6',
            marginBottom: '20px'
          }}>
            <strong>Application Under Review</strong>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#9a3412' }}>
              Your verification application is currently under review by administration. You will be automatically elevated to a Peer Reviewer with a trust baseline of 150.00 points upon approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAppSubmit} className="editorPanel" style={{ display: 'grid', gap: '16px', maxWidth: '640px', background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' }}>
            <div className="fieldRow" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                Organization / Role Type
                <select 
                  value={appForm.organizationType} 
                  onChange={e => setAppForm({ ...appForm, organizationType: e.target.value })}
                  required
                >
                  <option value="FACULTY">FACULTY (Professor / Instructor)</option>
                  <option value="RESEARCHER">RESEARCHER (Academic Analyst)</option>
                  <option value="CAMPUS_JOURNALIST">CAMPUS_JOURNALIST (Student Editor / Writer)</option>
                  <option value="CIVIC_VOLUNTEER">CIVIC_VOLUNTEER (Public Advocate)</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                Institutional Email
                <input 
                  type="email" 
                  placeholder="e.g. professor@cit.edu" 
                  value={appForm.institutionalEmail}
                  onChange={e => setAppForm({ ...appForm, institutionalEmail: e.target.value })}
                  required 
                />
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              Verification Proof URL (ID Card / Reference Letter Link)
              <input 
                type="url" 
                placeholder="https://drive.google.com/file/... or official portfolio link"
                value={appForm.verificationProofUrl}
                onChange={e => setAppForm({ ...appForm, verificationProofUrl: e.target.value })}
                required 
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              Justification & Background Statement
              <textarea 
                rows="4" 
                placeholder="Outline your background, academic affiliations, and motivation to serve as a Peer Reviewer..."
                value={appForm.justificationStatement}
                onChange={e => setAppForm({ ...appForm, justificationStatement: e.target.value })}
                required 
              />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
              <button type="submit" disabled={appState.status === 'loading'} style={{ width: 'auto', padding: '10px 24px' }}>
                {appState.status === 'loading' ? 'Submitting...' : 'Submit Peer Application'}
              </button>
              {appState.message && (
                <span className={`ty-meta ${appState.status === 'success' ? 'successText' : 'errorText'}`} style={{ color: appState.status === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                  {appState.message}
                </span>
              )}
            </div>
          </form>
        )}

        {/* Previous Applications list */}
        {applications.length > 0 && (
          <div style={{ marginTop: '30px', borderTop: '1px solid var(--line-hairline)', paddingTop: '20px' }}>
            <h4 className="ty-card-title" style={{ fontSize: '14px', marginBottom: '12px' }}>My Applications History</h4>
            <div style={{ display: 'grid', gap: '10px' }}>
              {applications.map((app) => (
                <div key={app.applicationId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-soft)' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{app.organizationType} Application</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>Email: {app.institutionalEmail}</span> | <span>Submitted: {new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    background: app.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.08)' : app.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(217, 119, 6, 0.08)',
                    color: app.status === 'APPROVED' ? 'var(--success)' : app.status === 'REJECTED' ? 'var(--danger)' : '#b45309',
                    border: `1px solid ${app.status === 'APPROVED' ? 'rgba(16,185,129,0.2)' : app.status === 'REJECTED' ? 'rgba(239,68,68,0.2)' : 'rgba(217,119,6,0.2)'}`
                  }}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {isSandboxMode && (
        <section className="matrixActionPanel">
          <div>
            <h3 className="ty-card-title">Submission Simulator</h3>
            <p className="ty-body">Commit mock outcomes into the shared developer context.</p>
          </div>
          <div className="matrixActionRow">
            <button onClick={simulateApprovedSubmission} type="button">+ Simulate Approved Submission</button>
            <button className="dangerButton" onClick={simulateRejectedSubmission} type="button">+ Simulate Rejected Submission</button>
          </div>
        </section>
      )}
    </>
  );
}

function LedgerFilterTabs({ entries, state }) {
  const [activeTab, setActiveTab] = useState(LEDGER_FILTER_TABS[0].key);
  const filteredEntries = useMemo(() => (
    activeTab === 'all'
      ? entries
      : entries.filter((entry) => ledgerEntryKind(entry) === activeTab)
  ), [activeTab, entries]);

  return (
    <section className="ledgerPanel" aria-label="Ledger filtering">
      <div className="ledgerFilterSection">
        <span className="ledgerFilterLabel">Ledger filtering:</span>
        <div className="ledgerFilterTabs" role="tablist" aria-label="Ledger entry filters">
          {LEDGER_FILTER_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? 'active' : ''}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {state?.status === 'loading' && (
        <div className="ledgerEmptyState">Loading ledger entries...</div>
      )}

      {state?.status !== 'loading' && filteredEntries.length === 0 && (
        <div className="ledgerEmptyState">{state?.message || 'No entries match this filter.'}</div>
      )}

      {state?.status !== 'loading' && filteredEntries.length > 0 && (
        <div className="ledgerEntryList">
          {filteredEntries.map((entry) => (
            <article className="ledgerEntry" key={entry.submissionId}>
              <div className="ledgerEntryTopline">
                <span className={`ledgerTypeBadge ${ledgerEntryKind(entry)}`}>{ledgerEntryKind(entry).toUpperCase()}</span>
                <span>{formatLedgerDate(entry.createdAt)}</span>
              </div>
              <strong>{entry.impactSummary || 'No impact summary provided.'}</strong>
              <div className="ledgerEntryMeta">
                <span>{entry.categoryTag || 'UNCATEGORIZED'}</span>
                <span>{entry.actionIdentifier || 'NO_ACTION'}</span>
                <span>{formatActionMetric(entry.actionDetails, entry.actionIdentifier)}</span>
                <span>{entry.status || 'SUBMITTED'}</span>
              </div>
              {entry.sourceUrl && (
                <a href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceUrl}</a>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewerMatrix({
  consensusRate,
  metrics,
  simulateConsensusVote,
  simulateDissentVote,
  tier,
  trustScore,
  isSandboxMode = false,
  token,
  user,
}) {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerState, setLedgerState] = useState({ status: 'loading', message: 'Loading ledger entries...' });

  useEffect(() => {
    let ignore = false;

    if (!user?.userId) {
      setLedgerEntries([]);
      setLedgerState({ status: 'error', message: 'Unable to load database ledger records without a user id.' });
      return () => {
        ignore = true;
      };
    }

    setLedgerState({ status: 'loading', message: 'Loading ledger entries...' });
    fetch(`${API_BASE_URL}/api/submissions/contributor/${user.userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        if (ignore) return;
        const entries = Array.isArray(data) ? data : [];
        setLedgerEntries(entries);
        setLedgerState({
          status: 'success',
          message: entries.length > 0 ? '' : 'No database ledger records found.',
        });
      })
      .catch((error) => {
        if (ignore) return;
        setLedgerEntries([]);
        setLedgerState({ status: 'error', message: error.message || 'Could not load database ledger records.' });
      });

    return () => {
      ignore = true;
    };
  }, [token, user?.userId]);

  return (
    <>
      <section className="matrixCardGrid">
        <MetricCard label="Audit Tier" value={tier.label} tone={tier.tone} />
        <MetricCard label="Active Voting Weight" value={`x${tier.weight}`} tone={tier.tone} />
        <MetricCard label="Trust Balance" value={<TrustScoreMeter score={trustScore} variant="compact" />} />
        <MetricCard label="Consensus-Aligned Ballots" value={metrics.reviewerConsensusVotes} tone="success" />
        <MetricCard label="Dissenting Ballots" value={metrics.reviewerDissentVotes} tone="danger" />
        <MetricCard label="Participation Rate" value={formatPercent(consensusRate)} />
      </section>

      <LedgerFilterTabs entries={ledgerEntries} state={ledgerState} />

      {isSandboxMode && (
        <section className="matrixActionPanel">
          <div>
            <h3 className="ty-card-title">Consensus Score Simulator</h3>
            <p className="ty-body">SRS Section 3.2 thresholds recalculate instantly as trust changes.</p>
          </div>
          <div className="matrixActionRow">
            <button onClick={simulateConsensusVote} type="button">+ Sim Consensus Vote</button>
            <button className="dangerButton" onClick={simulateDissentVote} type="button">+ Sim Dissenting Vote</button>
          </div>
        </section>
      )}
    </>
  );
}

function AdminMatrix({ adjustAdminInterventions, metrics, updateProfileMetric, isSandboxMode = false, token }) {
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
    // Snappy UI state mutation: instantly filter out this app locally
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
        <MetricCard label="Credential" value="ROLE_ADMIN" tone="admin" />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
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

      {isSandboxMode && (
        <section className="matrixActionPanel adminPanel">
          <div>
            <h3 className="ty-card-title">Accountability Bypass Keys</h3>
            <p className="ty-body">Toggle administrative override capabilities in the shared sandbox state.</p>
          </div>
          <div className="adminControlGrid">
            <div className="stepperControl">
              <button onClick={() => adjustAdminInterventions(-1)} type="button">-</button>
              <span>{metrics.adminInterventions}</span>
              <button onClick={() => adjustAdminInterventions(1)} type="button">+</button>
            </div>
            <label className="matrixToggle">
              <input
                checked={metrics.adminTieBreakerActive}
                onChange={(event) => updateProfileMetric('adminTieBreakerActive', event.target.checked)}
                type="checkbox"
              />
              <span>50-50 Tie Breaker</span>
            </label>
            <label className="matrixToggle">
              <input
                checked={metrics.adminTimeoutOverrideActive}
                onChange={(event) => updateProfileMetric('adminTimeoutOverrideActive', event.target.checked)}
                type="checkbox"
              />
              <span>24-Hour Timeout Override</span>
            </label>
          </div>
        </section>
      )}
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
