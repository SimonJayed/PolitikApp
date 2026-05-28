import { useEffect, useMemo, useState } from 'react';
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
          <TrustScoreMeter score={trustScore} showEligibility={activeRole !== 'ADMINISTRATOR' && activeRole !== 'ADMIN'} variant="compact" />
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

function AdminMatrix({ adjustAdminInterventions, metrics, updateProfileMetric, isSandboxMode = false }) {
  return (
    <>
      <section className="matrixCardGrid">
        <MetricCard label="Credential" value="ROLE_ADMIN" tone="admin" />
        <MetricCard label="Intervention Count" value={metrics.adminInterventions} />
        <MetricCard label="50-50 Tie Breaker" value={metrics.adminTieBreakerActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTieBreakerActive ? 'success' : 'danger'} />
        <MetricCard label="24-Hour Timeout Override" value={metrics.adminTimeoutOverrideActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTimeoutOverrideActive ? 'success' : 'danger'} />
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
