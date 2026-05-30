import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AccountLockStatus from './AccountLockStatus';
import PenaltyAlert from './PenaltyAlert';
import ContributorPenaltyDetail from './ContributorPenaltyDetail';
import { ShieldCheckIcon } from '../icons/Lucide';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const LEDGER_FILTER_TABS = [
  { key: 'all', label: 'ALL ENTRIES' },
  { key: 'audit', label: 'AUDIT ENTRIES' },
  { key: 'legislation', label: 'LEGISLATION ENTRIES' },
  { key: 'project', label: 'PROJECT ENTRIES' },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0));
}

function formatPercent(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function formatLedgerDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

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

export default function ContributorPenaltyDashboard({
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
      await fetch(`${API_BASE_URL}/api/peer-applications/submit`, {
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
      <AccountLockStatus rejectionLocked={rejectionLocked} rejectionRate={displayedMetrics.rate} />
      
      <PenaltyAlert rate={displayedMetrics.rate} />

      <ContributorPenaltyDetail
        submissions={displayedMetrics.submissions}
        approved={displayedMetrics.approved}
        rejected={displayedMetrics.rejected}
        rate={displayedMetrics.rate}
        rejectionLocked={rejectionLocked}
      />

      <LedgerFilterTabs entries={ledgerEntries} state={ledgerState} />

      {/* Peer Application Console */}
      <section className="matrixActionPanel peerAppPanel">
        <header className="peerAppHeader">
          <span className="peerAppHeaderIcon" aria-hidden="true"><ShieldCheckIcon size={18} /></span>
          <div>
          <h3 className="ty-card-title">Peer Reviewer Application</h3>
          <p className="ty-meta">
            Are you a university faculty, campus journalist, researcher, or civic volunteer? Elevate your role to PEER to review other submissions.
          </p>
          </div>
        </header>

        {hasPending ? (
          <div className="peerAppPending">
            <strong>Application Under Review</strong>
            <p>
              Your verification application is currently under review by administration. You will be automatically elevated to a Peer Reviewer with a trust baseline of 150.00 points upon approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleAppSubmit} className="editorPanel peerAppForm">
            <div className="peerAppFormColumns">
              <div className="peerAppLeftCol">
                <div className="fieldRow peerAppTwoCol">
                  <label>
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
                  <label>
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
                <label>
                  Verification Proof URL (ID Card / Reference Letter Link)
                  <input 
                    type="url" 
                    placeholder="https://drive.google.com/file/... or official portfolio link"
                    value={appForm.verificationProofUrl}
                    onChange={e => setAppForm({ ...appForm, verificationProofUrl: e.target.value })}
                    required 
                  />
                </label>
                <div className="peerAppActions">
                  <button type="submit" disabled={appState.status === 'loading'} style={{ width: 'auto', padding: '10px 24px' }}>
                    {appState.status === 'loading' ? 'Submitting...' : 'Submit Peer Application'}
                  </button>
                  {appState.message && (
                    <span className={`ty-meta ${appState.status === 'success' ? 'successText' : 'errorText'} peerAppStatus`}>
                      {appState.message}
                    </span>
                  )}
                </div>
              </div>
              <label className="peerAppJustificationField">
                Justification & Background Statement
                <textarea 
                  rows="7" 
                  placeholder="Outline your background, academic affiliations, and motivation to serve as a Peer Reviewer..."
                  value={appForm.justificationStatement}
                  onChange={e => setAppForm({ ...appForm, justificationStatement: e.target.value })}
                  required 
                />
              </label>
            </div>
          </form>
        )}

        {/* Previous Applications list */}
        {applications.length > 0 && (
          <div className="peerAppHistory">
            <h4 className="ty-card-title">My Applications History</h4>
            <div className="peerAppHistoryList">
              {applications.map((app) => (
                <div key={app.applicationId} className="peerAppHistoryRow">
                  <div>
                    <strong>{app.organizationType} Application</strong>
                    <div className="peerAppHistoryMeta">
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
export { LedgerFilterTabs };
