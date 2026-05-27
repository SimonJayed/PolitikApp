import { useMemo } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function resolveAuditorTier(trustScore) {
  if (trustScore >= 90) {
    return { label: 'Elite Auditor', weight: 5, tone: 'elite' };
  }
  if (trustScore >= 70) {
    return { label: 'Senior Auditor', weight: 3, tone: 'senior' };
  }
  return { label: 'Standard Auditor', weight: 1, tone: 'standard' };
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

export default function UserProfileMatrixPanel({ user }) {
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
  const trustScore = clampPercent(actor?.trustScore ?? 95);
  const descriptor = roleDescriptor(activeRole);
  const auditorTier = resolveAuditorTier(trustScore);
  const rejectionLocked = contributorRejectionRate > 15;
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
          <h2>{descriptor}</h2>
          <p>{actor?.name || actor?.fullName || 'Sandbox Actor'} is mapped to a live role metrics matrix.</p>
        </div>
        <div className="matrixHeroScore">
          <span>Trust Balance</span>
          <strong>{formatPercent(trustScore, 1)}</strong>
          <small>{actor?.status || 'ACTIVE'}</small>
        </div>
      </header>

      {activeRole === 'CONTRIBUTOR' && (
        <ContributorMatrix
          metrics={profileMetrics}
          rejectionLocked={rejectionLocked}
          rejectionRate={contributorRejectionRate}
          simulateApprovedSubmission={simulateApprovedSubmission}
          simulateRejectedSubmission={simulateRejectedSubmission}
          trustScore={trustScore}
        />
      )}

      {activeRole !== 'CONTRIBUTOR' && activeRole !== 'ADMINISTRATOR' && activeRole !== 'ADMIN' && (
        <ReviewerMatrix
          consensusRate={consensusRate}
          metrics={profileMetrics}
          simulateConsensusVote={simulateConsensusVote}
          simulateDissentVote={simulateDissentVote}
          tier={auditorTier}
          trustScore={trustScore}
        />
      )}

      {(activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN') && (
        <AdminMatrix
          adjustAdminInterventions={adjustAdminInterventions}
          metrics={profileMetrics}
          updateProfileMetric={updateProfileMetric}
        />
      )}
    </section>
  );
}

function ContributorMatrix({
  metrics,
  rejectionLocked,
  rejectionRate,
  simulateApprovedSubmission,
  simulateRejectedSubmission,
  trustScore,
}) {
  return (
    <>
      {rejectionLocked && (
        <section className="matrixLockoutCard">
          <strong>Automatic Contributor Lockout Active</strong>
          <span>Lifetime rejection rate is {formatPercent(rejectionRate)}. The sandbox account status has been switched to SUSPENDED.</span>
        </section>
      )}

      <section className="matrixCardGrid">
        <MetricCard label="Trust Balance" value={formatPercent(trustScore, 1)} />
        <MetricCard label="Active Submissions" value={metrics.contributorSubmissions} />
        <MetricCard label="Approved Cards" value={metrics.contributorApproved} tone="success" />
        <MetricCard label="Rejected Cards" value={metrics.contributorRejected} tone="danger" />
        <MetricCard label="Lifetime Rejection Rate" value={formatPercent(rejectionRate)} tone={rejectionLocked ? 'danger' : 'neutral'} />
      </section>

      <section className="matrixActionPanel">
        <div>
          <h3>Submission Simulator</h3>
          <p>Commit mock outcomes into the shared developer context.</p>
        </div>
        <div className="matrixActionRow">
          <button onClick={simulateApprovedSubmission} type="button">+ Simulate Approved Submission</button>
          <button className="dangerButton" onClick={simulateRejectedSubmission} type="button">+ Simulate Rejected Submission</button>
        </div>
      </section>
    </>
  );
}

function ReviewerMatrix({ consensusRate, metrics, simulateConsensusVote, simulateDissentVote, tier, trustScore }) {
  return (
    <>
      <section className="matrixCardGrid">
        <MetricCard label="Audit Tier" value={tier.label} tone={tier.tone} />
        <MetricCard label="Active Voting Weight" value={`x${tier.weight}`} tone={tier.tone} />
        <MetricCard label="Trust Balance" value={formatPercent(trustScore, 1)} />
        <MetricCard label="Consensus-Aligned Ballots" value={metrics.reviewerConsensusVotes} tone="success" />
        <MetricCard label="Dissenting Ballots" value={metrics.reviewerDissentVotes} tone="danger" />
        <MetricCard label="Participation Rate" value={formatPercent(consensusRate)} />
      </section>

      <section className="matrixActionPanel">
        <div>
          <h3>Consensus Score Simulator</h3>
          <p>SRS Section 3.2 thresholds recalculate instantly as trust changes.</p>
        </div>
        <div className="matrixActionRow">
          <button onClick={simulateConsensusVote} type="button">+ Sim Consensus Vote</button>
          <button className="dangerButton" onClick={simulateDissentVote} type="button">+ Sim Dissenting Vote</button>
        </div>
      </section>
    </>
  );
}

function AdminMatrix({ adjustAdminInterventions, metrics, updateProfileMetric }) {
  return (
    <>
      <section className="matrixCardGrid">
        <MetricCard label="Credential" value="ROLE_ADMIN" tone="admin" />
        <MetricCard label="Intervention Count" value={metrics.adminInterventions} />
        <MetricCard label="50-50 Tie Breaker" value={metrics.adminTieBreakerActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTieBreakerActive ? 'success' : 'danger'} />
        <MetricCard label="24-Hour Timeout Override" value={metrics.adminTimeoutOverrideActive ? 'Enabled' : 'Disabled'} tone={metrics.adminTimeoutOverrideActive ? 'success' : 'danger'} />
      </section>

      <section className="matrixActionPanel adminPanel">
        <div>
          <h3>Accountability Bypass Keys</h3>
          <p>Toggle administrative override capabilities in the shared sandbox state.</p>
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
