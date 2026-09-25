import { useEffect, useMemo, useState } from 'react';
import { CircleCheckIcon, FileTextIcon, ScaleIcon } from './icons/Lucide';
import UserHistoryPage from './UserHistoryPage';
import Account from '../pages/Account/Account';
import './ProfileMatrix.css';

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
  const actor = user;
  const activeRole = actor?.role || 'CONTRIBUTOR';
  const descriptor = roleDescriptor(activeRole);
  const isAdmin = activeRole === 'ADMINISTRATOR' || activeRole === 'ADMIN';

  // Dynamic profile metrics state
  const [dynamicMetrics, setDynamicMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!actor?.userId) return;

    let ignore = false;
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        if (isAdmin) {
          // Fetch real Admin Curation & Adjudication metrics
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const [queueData, summaryData] = await Promise.all([
            fetch(`${API_BASE_URL}/api/admin/adjudication/queue`, {
              headers,
            }).then(readApiResponse),
            fetch(`${API_BASE_URL}/api/admin/adjudication/summary`, {
              headers,
            }).then(readApiResponse),
          ]);

          if (ignore) return;

          const queueItems = Array.isArray(queueData) ? queueData : [];
          const pendingItems = queueItems.filter((i) =>
            ['SUBMITTED_REQUEST', 'CHALLENGE_OPEN', 'UNDER_REVIEW'].includes(i.queueStatus)
          );
          const upheldItems = queueItems.filter((i) => i.queueStatus === 'RESOLVED_UPHELD');
          const dismissedItems = queueItems.filter((i) => i.queueStatus === 'RESOLVED_DISMISSED');

          setDynamicMetrics({
            adminPendingAdjudications: Number(summaryData?.pendingAdjudications ?? pendingItems.length),
            adminCuratedRecords: Number(summaryData?.totalCuratedRecords ?? 0),
            adminUpheldRulings: Number(summaryData?.upheldRulings ?? upheldItems.length),
            adminDismissedRulings: Number(summaryData?.dismissedRulings ?? dismissedItems.length),
            adminPendingQueue: pendingItems,
          });
        } else {
          // Contributor / Citizen metrics
          const resSub = await fetch(`${API_BASE_URL}/api/submissions/my`, {
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
  }, [actor?.userId, activeRole, token, isAdmin]);

  const activeMetrics = dynamicMetrics;
  const displayName = actor?.name || actor?.fullName || 'Your profile';
  const displayEmail = actor?.email || 'Email unavailable';
  const displayInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U';

  const headerTone = useMemo(() => {
    if (isAdmin) return 'matrixHero admin';
    return 'matrixHero contributor';
  }, [isAdmin]);

  if (!activeMetrics && loading) {
    return (
      <section className="workspace profileMatrixWorkspace">
        <div className="profileMatrixState">Loading your profile metrics...</div>
      </section>
    );
  }

  if (!activeMetrics && error) {
    return (
      <section className="workspace profileMatrixWorkspace">
        <div className="profileMatrixState">Unable to load profile metrics. {error}</div>
      </section>
    );
  }

  const metricCards = isAdmin
    ? [
        ['Curated records', activeMetrics?.adminCuratedRecords ?? 0],
        ['Awaiting ruling', activeMetrics?.adminPendingAdjudications ?? 0],
        ['Upheld rulings', activeMetrics?.adminUpheldRulings ?? 0],
        ['Dismissed rulings', activeMetrics?.adminDismissedRulings ?? 0],
      ]
    : [
        ['Proposals filed', activeMetrics?.contributorSubmissions ?? 0],
        ['Under review', activeMetrics?.contributorUnderReview ?? 0],
        ['Published', activeMetrics?.contributorPublished ?? 0],
        ['Role', activeRole],
      ];

  return (
    <section className="workspace profileMatrixWorkspace">
      <header className={headerTone.replace('matrixHero', 'profileMatrixHero')}>
        <div className="profileMatrixHeroAvatar" aria-hidden="true">{displayInitials}</div>
        <div className="profileMatrixHeroCopy">
          <span className="profileMatrixRoleBadge">{isAdmin ? 'ADMIN CURATOR' : 'CITIZEN'}</span>
          <h2 className="profileMatrixHeroTitle">{displayName}</h2>
          <p className="profileMatrixHeroText">{descriptor}</p>
          <p className="profileMatrixHeroSubtext">{displayEmail}</p>
        </div>
        <div className="profileMatrixHeroScore">
          <span className="profileMatrixHeroScoreLabel">Account status</span>
          <span className="profileMatrixStatus">{actor?.status || actor?.accountStatus || 'ACTIVE'}</span>
        </div>
      </header>

      <div className="profileMatrixMetrics" aria-label="Profile summary metrics">
        {metricCards.map(([label, value]) => (
          <article className="profileMatrixMetric" key={label}>
            <span className="profileMatrixMetricLabel">{label}</span>
            <strong className="profileMatrixMetricValue">{value}</strong>
          </article>
        ))}
      </div>

      <div className="profileMatrixPrimaryGrid">
        <section className="profileMatrixUnifiedSection" aria-labelledby="profile-details-heading">
          <header className="profileMatrixSectionHeader">
            <p className="profileMatrixSectionKicker">Profile</p>
            <h3 id="profile-details-heading" className="profileMatrixSectionTitle">User information</h3>
            <p className="profileMatrixPanelDescription">
              Manage your public identity and account status.
            </p>
          </header>
          <Account embedded token={token} user={actor} />
        </section>

        {/* Admin Matrix Layout */}
        {isAdmin && (
          <AdminMatrix
            metrics={activeMetrics || {}}
            onRefresh={() => {
              // Trigger refresh
            }}
          />
        )}

        {/* Contributor / Citizen Matrix Layout */}
        {!isAdmin && (
          <CitizenMatrix
            metrics={activeMetrics || {}}
          />
        )}
      </div>

      <section className="profileMatrixUnifiedSection" aria-labelledby="profile-history-heading">
        <header className="profileMatrixSectionHeader">
          <p className="profileMatrixSectionKicker">Activity / History</p>
          <h3 id="profile-history-heading" className="profileMatrixSectionTitle">Account event ledger</h3>
          <p className="profileMatrixPanelDescription">
            Browse account decisions, status changes, and moderation outcomes tied to your profile.
          </p>
        </header>
        <UserHistoryPage embedded token={token} />
      </section>
    </section>
  );
}

function AdminMatrix({ metrics = {} }) {
  const pendingQueue = metrics.adminPendingQueue || [];

  return (
    <>
      {/* Admin Active Adjudication Workbench */}
      <section
        className="profileMatrixPanel"
      >
        <header className="profileMatrixPanelHeader">
          <div>
            <h3 className="profileMatrixPanelTitle">
              <ScaleIcon size={18} /> Active Adjudication Workbench
            </h3>
            <p className="profileMatrixPanelDescription">
              Pending citizen metric proposals and public challenges requiring administrative primary-source review.
            </p>
          </div>
          <span className="profileMatrixQueueCount">
            {pendingQueue.length} items awaiting ruling
          </span>
        </header>

        {pendingQueue.length === 0 ? (
          <div className="profileMatrixState">
            <CircleCheckIcon size={28} style={{ marginBottom: '6px' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>
              Adjudication Queue Clear
            </h4>
            <p style={{ margin: 0, fontSize: '12px' }}>
              No pending citizen requests or public challenges require administrative investigation right now.
            </p>
          </div>
        ) : (
          <div className="profileMatrixList">
            {pendingQueue.slice(0, 5).map((item) => {
              const isChallenge = item.itemType === 'PUBLIC_CHALLENGE';
              return (
                <div className={`profileMatrixListItem${isChallenge ? ' challenge' : ''}`} key={item.queueId}>
                  <div className="profileMatrixListCopy">
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
                    <p className="profileMatrixListMeta">
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

function CitizenMatrix({ metrics = {} }) {
  const entries = metrics.contributorEntries || [];

  return (
    <>
      {/* Citizen Activity Ledger */}
      <section
        className="profileMatrixPanel"
      >
        <header className="profileMatrixPanelHeader">
          <div>
          <h3 className="profileMatrixPanelTitle">
            <FileTextIcon size={18} /> Citizen Contributions & Proposals
          </h3>
          <p className="profileMatrixPanelDescription">
            All metric proposals undergo direct Admin Curator verification with official primary sources.
          </p>
          </div>
          <span className="profileMatrixQueueCount">{entries.length} total proposals</span>
        </header>

        {entries.length === 0 ? (
          <div className="profileMatrixState">
            <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
              No proposals filed yet. Propose bills, projects, or audits to enrich public servant records.
            </p>
          </div>
        ) : (
          <div className="profileMatrixList">
            {entries.slice(0, 5).map((entry) => (
              <div className="profileMatrixListItem" key={entry.submissionId}>
                <div className="profileMatrixListCopy">
                  <strong className="profileMatrixListTitle">{entry.impactSummary || 'Untitled proposal'}</strong>
                  <span className="profileMatrixListMeta">{entry.categoryTag || 'Uncategorized'}</span>
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

