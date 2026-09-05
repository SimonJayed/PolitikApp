import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';
import './module3/Module3.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function roleDescriptor(role) {
  if (role === 'CONTRIBUTOR') {
    return 'Citizen Contributor & Fact Checker';
  }
  if (role === 'ADMINISTRATOR' || role === 'ADMIN') {
    return 'Admin Curator & Lead Adjudicator';
  }
  return 'Civic Member';
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
  } = sandbox;

  const [liveUser, setLiveUser] = useState(null);

  useEffect(() => {
    if (isDevModeActive) return;

    let ignore = false;
    fetch(`${API_BASE_URL}/users/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        if (!ignore && data) {
          setLiveUser(data);
        }
      })
      .catch((err) => console.error('Failed to sync live profile:', err));

    return () => {
      ignore = true;
    };
  }, [token, isDevModeActive]);

  const actor = isDevModeActive && manipulatedUser ? manipulatedUser : (liveUser || user);
  const activeRole = actor?.role || 'CONTRIBUTOR';
  const descriptor = roleDescriptor(activeRole);
  const isAdmin = activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN';

  // Dynamic profile metrics state
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
        if (isAdmin) {
          // Fetch real Admin Curation & Adjudication metrics
          const [resQueue, resPoliticians] = await Promise.all([
            fetch(`${API_BASE_URL}/api/admin/adjudication/queue`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }).catch(() => null),
            fetch(`${API_BASE_URL}/api/politicians`).catch(() => null),
          ]);

          const queueData = resQueue && resQueue.ok ? await resQueue.json().catch(() => []) : [];
          const politiciansData = resPoliticians && resPoliticians.ok ? await resPoliticians.json().catch(() => []) : [];

          if (ignore) return;

          const queueItems = Array.isArray(queueData) ? queueData : [];
          const pendingItems = queueItems.filter((i) =>
            ['SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW'].includes(i.queueStatus)
          );
          const upheldItems = queueItems.filter((i) => i.queueStatus === 'RESOLVED_UPHELD');
          const dismissedItems = queueItems.filter((i) => i.queueStatus === 'RESOLVED_DISMISSED');

          // Count published timeline records
          let totalPublished = 0;
          if (Array.isArray(politiciansData)) {
            for (const p of politiciansData) {
              totalPublished += Number(p.billsAuthored || 0) + Number(p.projectCompletions || 0);
            }
          }

          setDynamicMetrics({
            adminPendingAdjudications: pendingItems.length,
            adminCuratedRecords: Math.max(totalPublished, 5),
            adminUpheldRulings: upheldItems.length,
            adminDismissedRulings: dismissedItems.length,
            adminPendingQueue: pendingItems,
          });
        } else {
          // Contributor / Citizen metrics
          const resSub = await fetch(`${API_BASE_URL}/api/submissions`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const submissionsData = await readApiResponse(resSub);
          if (ignore) return;

          const entries = Array.isArray(submissionsData) ? submissionsData : [];
          const submissions = entries.length;
          const underReview = entries.filter((e) =>
            ['SUBMITTED_REQUEST', 'UNDER_REVIEW', 'CHALLENGE_OPEN'].includes(e.status)
          ).length;
          const published = entries.filter((e) =>
            ['PUBLISHED', 'RESOLVED_UPHELD'].includes(e.status)
          ).length;

          setDynamicMetrics({
            contributorSubmissions: submissions,
            contributorUnderReview: underReview,
            contributorPublished: published,
            contributorEntries: entries,
          });
        }
      } catch (err) {
        console.error('Failed to fetch live profile metrics:', err);
        if (!ignore) {
          setError(err.message || 'Failed to fetch live profile metrics.');
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
  }, [isDevModeActive, actor?.userId, activeRole, token, isAdmin]);

  const activeMetrics = isDevModeActive
    ? {
        adminPendingAdjudications: profileMetrics?.adminPendingAdjudications ?? 1,
        adminCuratedRecords: profileMetrics?.adminCuratedRecords ?? 12,
        adminUpheldRulings: profileMetrics?.adminUpheldRulings ?? 3,
        adminDismissedRulings: profileMetrics?.adminDismissedRulings ?? 0,
        contributorSubmissions: profileMetrics?.contributorSubmissions ?? 4,
        contributorUnderReview: 1,
        contributorPublished: profileMetrics?.contributorApproved ?? 3,
        adminPendingQueue: [],
      }
    : dynamicMetrics;

  const headerTone = useMemo(() => {
    if (isAdmin) return 'matrixHero admin';
    return 'matrixHero contributor';
  }, [isAdmin]);

  if (!activeMetrics && loading) {
    return (
      <section className="workspace profileMatrixWorkspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ledgerEmptyState">Loading curation & profile metrics...</div>
      </section>
    );
  }

  return (
    <section className="workspace profileMatrixWorkspace">
      <header className={headerTone}>
        <div>
          <span className="matrixRoleBadge">{isAdmin ? 'ADMIN CURATOR' : 'CITIZEN'}</span>
          <h2 className="ty-section-title">{descriptor}</h2>
          <p className="ty-body">
            {actor?.name || actor?.fullName || 'User'} is connected to the Centralized Evidence-Based Curation Pipeline.
          </p>
        </div>
        <div className="matrixHeroScore">
          <small>{actor?.status || actor?.accountStatus || 'ACTIVE'}</small>
        </div>
      </header>

      {/* Admin Matrix Layout */}
      {isAdmin && (
        <AdminMatrix
          metrics={activeMetrics || {}}
          token={token}
          onRefresh={() => {
            // Trigger refresh
          }}
        />
      )}

      {/* Contributor / Citizen Matrix Layout */}
      {!isAdmin && (
        <CitizenMatrix
          metrics={activeMetrics || {}}
          token={token}
          user={actor}
        />
      )}
    </section>
  );
}

function AdminMatrix({ metrics = {}, token }) {
  const pendingQueue = metrics.adminPendingQueue || [];

  return (
    <>
      {/* Admin Active Adjudication Workbench */}
      <section
        className="matrixActionPanel"
        style={{
          marginTop: '24px',
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--line-soft, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid var(--line-hairline, #f1f5f9)',
            paddingBottom: '12px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 className="ty-card-title" style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary, #0f172a)' }}>
              ⚖️ Active Adjudication Workbench
            </h3>
            <p className="ty-meta" style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
              Pending citizen metric proposals and public challenges requiring administrative primary-source review.
            </p>
          </div>
          <span
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#0284c7',
              background: '#e0f2fe',
              padding: '4px 10px',
              borderRadius: '9999px',
            }}
          >
            {pendingQueue.length} items awaiting ruling
          </span>
        </header>

        {pendingQueue.length === 0 ? (
          <div
            style={{
              padding: '36px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>✓</div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>
              Adjudication Queue Clear
            </h4>
            <p style={{ margin: 0, fontSize: '12px' }}>
              No pending citizen requests or public challenges require administrative investigation right now.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingQueue.slice(0, 5).map((item) => {
              const isChallenge = item.itemType === 'PUBLIC_CHALLENGE';
              return (
                <div
                  key={item.queueId}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: isChallenge ? '1px solid #fecaca' : '1px solid #e2e8f0',
                    background: isChallenge ? '#fff5f5' : '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          background: isChallenge ? '#ef4444' : '#0284c7',
                          color: '#ffffff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '700',
                        }}
                      >
                        {isChallenge ? 'PUBLIC CHALLENGE' : 'CONTENT PROPOSAL'}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {item.politicianName}
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                      {item.summary || item.challengeReason || 'Item under adjudication'}
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '9999px',
                      background: item.queueStatus === 'UNDER_REVIEW' ? '#fef3c7' : '#e0f2fe',
                      color: item.queueStatus === 'UNDER_REVIEW' ? '#d97706' : '#0284c7',
                    }}
                  >
                    {item.queueStatus}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function CitizenMatrix({ metrics = {}, user }) {
  const entries = metrics.contributorEntries || [];

  return (
    <>
      {/* Citizen Activity Ledger */}
      <section
        className="matrixActionPanel"
        style={{
          marginTop: '24px',
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--line-soft, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '24px',
        }}
      >
        <header
          style={{
            borderBottom: '1px solid var(--line-hairline, #f1f5f9)',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}
        >
          <h3 className="ty-card-title" style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>
            📝 Citizen Contributions & Proposals
          </h3>
          <p className="ty-meta" style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            All metric proposals undergo direct Admin Curator verification with official primary sources.
          </p>
        </header>

        {entries.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
            }}
          >
            <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
              No proposals filed yet. Propose bills, projects, or audits to enrich public servant records.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {entries.slice(0, 5).map((entry) => (
              <div
                key={entry.submissionId}
                style={{
                  padding: '12px 14px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                }}
              >
                <div>
                  <strong>{entry.impactSummary}</strong>
                  <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '11px' }}>
                    ({entry.categoryTag})
                  </span>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: entry.status === 'PUBLISHED' ? '#dcfce7' : '#e0f2fe',
                    color: entry.status === 'PUBLISHED' ? '#15803d' : '#0284c7',
                  }}
                >
                  {entry.status || 'SUBMITTED_REQUEST'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

