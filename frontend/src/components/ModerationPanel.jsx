import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';
import { clampTrustScore } from './trustScore';
import LifecycleStageStrip, { getLifecycleStageIndex } from './LifecycleStageStrip';
import { ModerationCardsSkeleton } from './Skeletons';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  FlagIcon,
  GavelIcon,
  ShieldCheckIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  UserCircleIcon,
} from './icons/Lucide';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const STAGES = ['SUBMITTED', 'JURY_REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED'];

export default function ModerationPanel({ token, user }) {
  const [queue, setQueue] = useState([]);
  const [traceLogs, setTraceLogs] = useState([]);
  const [formByCard, setFormByCard] = useState({});
  const [queuePage, setQueuePage] = useState(1);
  const [queueLoading, setQueueLoading] = useState(true);
  const [escalatedLoading, setEscalatedLoading] = useState(true);
  const [showTraceMonitor, setShowTraceMonitor] = useState(true);
  const [openDrawerByCard, setOpenDrawerByCard] = useState({});
  const [openDetailsByCard, setOpenDetailsByCard] = useState({});
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [ballotArchive, setBallotArchive] = useState([]);
  const previousQueueRef = useRef([]);
  // persist preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('moderation:showTrace');
      if (saved !== null) setShowTraceMonitor(saved === '1');
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('moderation:showTrace', showTraceMonitor ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showTraceMonitor]);

  const sandboxContext = useDeveloperSandbox() || {};
  const isDevModeActive = sandboxContext.isDevModeActive || false;
  const manipulatedUser = sandboxContext.manipulatedUser || null;
  const voteWeight = sandboxContext.voteWeight || 1;
  const archiveStorageKey = `moderation:archive:${user?.userId || manipulatedUser?.userId || 'anonymous'}`;

  const getSandboxHeaders = () => {
    const headers = { Authorization: token ? `Bearer ${token}` : '' };
    if (isDevModeActive && manipulatedUser?.role) {
      headers['X-Sandbox-Role-Override'] = manipulatedUser.role;
    }
    return headers;
  };

  const isReadOnlyMode = isDevModeActive && manipulatedUser && manipulatedUser.role === 'CONTRIBUTOR';
  const isAdminMode = (isDevModeActive && manipulatedUser?.role === 'ADMIN') || (!isDevModeActive && user?.role === 'ADMIN');

  const [escalatedQueue, setEscalatedQueue] = useState([]);
  const queuePageSize = 2;

  useEffect(() => {
    fetchQueue();
    fetchEscalatedQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchQueue() {
    setQueueLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/pending`, {
        headers: getSandboxHeaders()
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Response payload is not an array: ' + JSON.stringify(data));
      }
      setQueue(data);
    } catch (err) {
      console.error('Failed to update review queue:', err);
      setTraceLogs((prev) => [`[ERROR FETCH QUEUE] ${err.message}`, ...prev]);
    } finally {
      setQueueLoading(false);
    }
  }

  async function fetchEscalatedQueue() {
    setEscalatedLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/escalated`, {
        headers: getSandboxHeaders()
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Response payload is not an array: ' + JSON.stringify(data));
      }
      setEscalatedQueue(data);
    } catch (err) {
      console.error('Failed to update admin arbitration queue:', err);
      setTraceLogs((prev) => [`[ERROR FETCH ESCALATED] ${err.message}`, ...prev]);
    } finally {
      setEscalatedLoading(false);
    }
  }

  const combinedQueue = useMemo(() => {
    if (isDevModeActive && sandboxContext.injectedQueue) {
      const mappedInjected = sandboxContext.injectedQueue.map(card => ({
        ...card,
        queueId: card.queueId || card.submissionId,
        queueStatus: card.queueStatus || 'JURY_REVIEW',
        isInjected: true
      }));
      return [...mappedInjected, ...queue];
    }
    return queue;
  }, [queue, sandboxContext.injectedQueue, isDevModeActive]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(archiveStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setBallotArchive(parsed);
      }
    } catch {
      // ignore
    }
  }, [archiveStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(archiveStorageKey, JSON.stringify(ballotArchive));
    } catch {
      // ignore
    }
  }, [archiveStorageKey, ballotArchive]);

  function upsertArchiveEntry(entry) {
    setBallotArchive((current) => {
      const next = [entry, ...current.filter((item) => item.queueId !== entry.queueId)];
      return next.slice(0, 100);
    });
  }

  const totalQueuePages = Math.max(1, Math.ceil(combinedQueue.length / queuePageSize));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const queueDeck = useMemo(
    () => combinedQueue.slice((safeQueuePage - 1) * queuePageSize, safeQueuePage * queuePageSize),
    [combinedQueue, safeQueuePage],
  );

  useEffect(() => {
    if (queuePage !== safeQueuePage) {
      setQueuePage(safeQueuePage);
    }
  }, [queuePage, safeQueuePage]);

  useEffect(() => {
    const previousQueue = previousQueueRef.current;
    if (previousQueue.length > 0) {
      const activeIds = new Set(combinedQueue.map((card) => card.queueId));
      previousQueue.forEach((card) => {
        if (!activeIds.has(card.queueId)) {
          upsertArchiveEntry({
            queueId: card.queueId,
            title: card.impactSummary || card.actionIdentifier || card.queueId,
            userVote: '—',
            status: 'NO_LONGER_ACTIVE',
            votedAt: new Date().toISOString(),
            reviewer: 'System',
            sourceUrl: card.sourceUrl || '',
          });
        }
      });
    }
    previousQueueRef.current = combinedQueue;
  }, [combinedQueue]);

  function getForm(queueId) {
    return formByCard[queueId] || { voteSelection: 'AGREE', voteReason: '' };
  }

  function parseActionDetails(card) {
    if (card?.actionDetails && typeof card.actionDetails === 'object') return card.actionDetails;
    if (!card?.actionDetailsJson) return {};
    try {
      return JSON.parse(card.actionDetailsJson);
    } catch {
      return {};
    }
  }

  function metricValue(details, key, fallback = 'Not provided') {
    const value = details?.[key];
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  function updateForm(queueId, updates) {
    setFormByCard((current) => ({
      ...current,
      [queueId]: { ...getForm(queueId), ...updates },
    }));
  }

  async function handleVoteSubmit(card) {
    if (!card?.queueId) {
      return;
    }

    if (isDevModeActive && manipulatedUser && manipulatedUser.status === 'SUSPENDED') {
      setTraceLogs((prev) => [
        `[SECURITY BLOCK] Locked out user "${manipulatedUser.name}" from voting. Status: SUSPENDED.`,
        ...prev,
      ]);
      return;
    }

    if (isReadOnlyMode) {
      setTraceLogs((prev) => [
        `[SECURITY BLOCK] Locked out user "${manipulatedUser.name}" from voting. Role: CONTRIBUTOR (Read-Only).`,
        ...prev,
      ]);
      return;
    }

    const form = getForm(card.queueId);

    if (card.isInjected) {
      upsertArchiveEntry({
        queueId: card.queueId,
        title: card.impactSummary || card.actionIdentifier || card.queueId,
        userVote: form.voteSelection,
        status: 'PUBLISHED',
        votedAt: new Date().toISOString(),
        reviewer: (isDevModeActive ? manipulatedUser?.name : user?.fullName) || 'Reviewer',
        sourceUrl: card.sourceUrl || '',
      });
      setTraceLogs((prev) => [
        `[CALC TRACE] [MOCK OVERRIDE] ${(isDevModeActive ? manipulatedUser?.name : 'Reviewer')} voted ${form.voteSelection} on INJECTED sandbox card. Weight: ${voteWeight}. Local outcome adjusted to published.`,
        ...prev,
      ]);

      if (sandboxContext.setInjectedQueue) {
        sandboxContext.setInjectedQueue(prev => prev.filter(c => c.submissionId !== card.queueId && c.queueId !== card.queueId));
      }
      updateForm(card.queueId, { voteReason: '' });
      return;
    }

    const payload = {
      queueId: card.queueId,
      peerId: user?.userId || '88bc8912-43ba-4abc-882a-ef92481aa323',
      voteSelection: form.voteSelection,
      voteReason: form.voteReason,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSandboxHeaders()
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Vote failed');
      }

      const trace = await res.json();
      upsertArchiveEntry({
        queueId: card.queueId,
        title: card.impactSummary || card.actionIdentifier || card.queueId,
        userVote: form.voteSelection,
        status: trace.finalOutcomeStatus || card.queueStatus || 'FINALIZED',
        votedAt: new Date().toISOString(),
        reviewer: (isDevModeActive ? manipulatedUser?.name : trace.peerName) || user?.fullName || 'Reviewer',
        sourceUrl: card.sourceUrl || '',
      });
      setTraceLogs((prev) => [
        `[CALC TRACE] ${(isDevModeActive ? manipulatedUser?.name : trace.peerName) || 'Reviewer'} voted ${form.voteSelection}. Weight: ${isDevModeActive ? voteWeight : trace.derivedWeight}. Outcome: ${trace.finalOutcomeStatus}`,
        ...prev,
      ]);

      updateForm(card.queueId, { voteReason: '' });
      fetchQueue();
    } catch (err) {
      setTraceLogs((prev) => [`[ERROR] ${err.message}`, ...prev]);
    }
  }

  async function handleSandboxShiftStage(queueId, direction) {
    const card = combinedQueue.find(c => c.queueId === queueId);
    if (card && card.isInjected) {
      const currentStage = getLifecycleStageIndex(card.queueStatus);
      const nextStageIndex = direction === 'next' ? Math.min(STAGES.length - 1, currentStage + 1) : Math.max(0, currentStage - 1);
      const newStatus = STAGES[nextStageIndex];

      setTraceLogs((prev) => [
        `[SANDBOX OVERRIDE] [MOCK] Shifted Injected Queue ID ${queueId.substring(0, 8)} stage ${direction === 'next' ? 'FORWARD ➡️' : 'BACKWARD ⬅️'} to status ${newStatus}.`,
        ...prev,
      ]);

      if (sandboxContext.setInjectedQueue) {
        sandboxContext.setInjectedQueue(prev => prev.map(c =>
          (c.submissionId === queueId || c.queueId === queueId) ? { ...c, queueStatus: newStatus } : c
        ));
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/sandbox/shift-stage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSandboxHeaders()
        },
        body: JSON.stringify({ queueId, direction })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Stage shift failed');
      }
      const data = await res.json();
      setTraceLogs((prev) => [
        `[SANDBOX OVERRIDE] Shifted Queue ID ${queueId.substring(0, 8)} stage ${direction === 'next' ? 'FORWARD ➡️' : 'BACKWARD ⬅️'} to status ${data.newStatus}.`,
        ...prev,
      ]);
      fetchQueue();
      fetchEscalatedQueue();
    } catch (err) {
      setTraceLogs((prev) => [`[ERROR] ${err.message}`, ...prev]);
    }
  }

  async function handleAdminOverride(queueId, action) {
    const form = getForm(queueId);
    if (!form.voteReason || !form.voteReason.trim()) {
      alert("Please provide an administrative override justification reason in the justification input field.");
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSandboxHeaders()
        },
        body: JSON.stringify({
          queueId,
          action,
          reason: form.voteReason.trim()
        })
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Override failed');
      }

      setTraceLogs((prev) => [
        `[ADMIN OVERRIDE] System Administrator manually resolved Queue ID ${queueId.substring(0, 8)} to status ${action}. Justification: "${form.voteReason.trim()}"`,
        ...prev,
      ]);

      updateForm(queueId, { voteReason: '' });
      fetchQueue();
      fetchEscalatedQueue();
    } catch (err) {
      setTraceLogs((prev) => [`[ERROR] ${err.message}`, ...prev]);
    }
  }

  return (
    <div className="moderation-container">
      <div className="mod-header">
        <div className="mod-header-copy">
          <div className="mod-header-titleRow">
            <span className="mod-header-icon"><GavelIcon size={20} /></span>
            <div>
              <h2 className="ty-section-title">Asynchronous Judicial Moderation Engine</h2>
              <p>Pending Queue cards require community jury adjudication before publication.</p>
            </div>
          </div>
          <div className="mod-header-stats">
            <span className="mod-statChip"><ShieldCheckIcon size={16} /> Community Review</span>
            <span className="mod-statChip"><AlertTriangleIcon size={16} /> Escalation Ready</span>
          </div>
        </div>
      </div>

      {queueLoading ? (
        <ModerationCardsSkeleton count={2} />
      ) : (
      <div className="queue-deck">
        {queueDeck.length === 0 && (
          <div className="review-card">
            <p className="emptyState">No pending moderation cards in queue.</p>
          </div>
        )}
        {queueDeck.map((card) => {
          const form = getForm(card.queueId);
          const isDrawerOpen = openDrawerByCard[card.queueId] || false;
          const isDetailsOpen = openDetailsByCard[card.queueId] || false;
          const details = parseActionDetails(card);
          
          const hashCharSum = String(card.queueId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const agreeCount = (hashCharSum % 7) + 1;
          const disagreeCount = (hashCharSum % 3);
          const flagCount = (hashCharSum % 2);
          const totalVotes = agreeCount + disagreeCount + flagCount;
          
          const quorumTarget = (hashCharSum % 4) + 4;
          const currentConsensus = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;
          
          const currentTrust = clampTrustScore(manipulatedUser?.trustScore ?? 100);
          const trustIfPublished = Math.min(500, currentTrust + 3.5).toFixed(2);
          const trustIfRejected = Math.max(0, currentTrust - 12.0).toFixed(2);

          return (
            <div className="review-card" key={card.queueId}>
              {isDevModeActive && (
                <div className="sandbox-override-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)', padding: '8px 12px', borderBottom: '1px solid #334155', borderRadius: '6px 6px 0 0', margin: '-16px -16px 16px -16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>🛠️ SANDBOX PROCESS OVERRIDE</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => handleSandboxShiftStage(card.queueId, 'prev')} style={{ background: '#334155', border: '1px solid #475569', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                      ⬅️ Previous Stage
                    </button>
                    <button type="button" onClick={() => handleSandboxShiftStage(card.queueId, 'next')} style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                      Next Stage ➡️
                    </button>
                  </div>
                </div>
              )}

              <div className="review-cardTop">
                <div className="review-cardIdentity">
                  <span className="review-cardIcon"><UserCircleIcon size={18} /></span>
                  <div>
                    <p className="review-cardLabel">Submitted By</p>
                    <p className="review-cardValue">{card.contributorName || 'Not provided'}</p>
                  </div>
                </div>
                <div className="review-cardMetaPill">Queue #{String(card.queueId).slice(0, 8)}</div>
              </div>

              <div className="review-cardFacts">
                <div className="review-cardFact">
                  <span className="review-cardFactLabel">Contribution Name</span>
                  <strong>{card.actionIdentifier || card.categoryTag || 'Not provided'}</strong>
                </div>
                <div className="review-cardFact">
                  <span className="review-cardFactLabel">Politician</span>
                  <strong>{card.politicianName || card.politicianId || 'Not provided'}</strong>
                </div>
                <div className="review-cardFact review-cardFactLink">
                  <span className="review-cardFactLabel">Source Link</span>
                  <a href={card.sourceUrl} rel="noreferrer" target="_blank">
                    <ExternalLinkIcon size={14} />
                    <span>{card.sourceUrl}</span>
                  </a>
                </div>
              </div>

              <div className="review-cardFacts">
                <div className="review-cardFact">
                  <span className="review-cardFactLabel">Category</span>
                  <strong>{card.categoryTag || 'Not provided'}</strong>
                </div>
                <div className="review-cardFact">
                  <span className="review-cardFactLabel">Jurisdiction</span>
                  <strong>{card.jurisdiction || 'Not provided'}</strong>
                </div>
                <div className="review-cardFact">
                  <span className="review-cardFactLabel">Submitted Date</span>
                  <strong>{card.createdAt ? new Date(card.createdAt).toLocaleString('en-PH') : 'Not provided'}</strong>
                </div>
              </div>

              <div className="summary-box">"{card.impactSummary || 'Not provided'}"</div>

              <LifecycleStageStrip status={card.queueStatus} title="Current Lifecycle Stage" />

              <div className="detailsBlock detailsBlock--moderation">
                <h5 className="ty-label" style={{ margin: 0 }}>Submitted Metrics</h5>
                <div className="review-cardFacts">
                  <div className="review-cardFact"><span className="review-cardFactLabel">Bills Authored</span><strong>{metricValue(details, 'billsAuthored')}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">Projects Completed</span><strong>{metricValue(details, 'projectsCompleted')}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">COA Findings</span><strong>{metricValue(details, 'coaFindings')}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">Efficiency</span><strong>{metricValue(details, 'efficiency')}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">Term Start</span><strong>{card.termStart || 'Not provided'}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">Term End</span><strong>{card.termEnd || 'Not provided'}</strong></div>
                  <div className="review-cardFact"><span className="review-cardFactLabel">Status</span><strong>{card.politicianStatus || 'Not provided'}</strong></div>
                </div>
                <button
                  type="button"
                  className="paginationButton"
                  onClick={() => setOpenDetailsByCard((prev) => ({ ...prev, [card.queueId]: !isDetailsOpen }))}
                  style={{ marginTop: '10px', width: 'auto', minWidth: '140px', borderRadius: '12px', padding: '0 12px' }}
                >
                  {isDetailsOpen ? 'Hide full details' : 'View full details'}
                </button>
                {isDetailsOpen && (
                  <div className="summary-box" style={{ marginTop: '10px' }}>
                    <p style={{ margin: 0 }}><strong>Contributor Notes:</strong> {card.impactSummary || 'Not provided'}</p>
                    <p style={{ margin: '8px 0 0' }}><strong>Action Details:</strong> {Object.keys(details).length ? JSON.stringify(details) : 'Not provided'}</p>
                  </div>
                )}
              </div>

              <div className="ballot-console">
                <div className="ballot-consoleHeader">
                  <span className="ballot-consoleIcon"><ShieldCheckIcon size={18} /></span>
                  <h4 className="ty-card-title" style={{ margin: 0 }}>Cast Evaluation Ballot</h4>
                </div>

                {isReadOnlyMode && (
                  <div className="status-toast" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
                    Access Denied: Contributor accounts are restricted to Read-Only mode.
                  </div>
                )}

                <div className="vote-options">
                  <label className={form.voteSelection === 'AGREE' ? 'vote-option vote-option-agree is-selected' : 'vote-option vote-option-agree'}>
                    <input
                      checked={form.voteSelection === 'AGREE'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="AGREE"
                    />
                    <span className="vote-optionIcon"><ThumbUpIcon size={16} /></span>
                    <span>Agree</span>
                  </label>

                  <label className={form.voteSelection === 'DISAGREE' ? 'vote-option vote-option-disagree is-selected' : 'vote-option vote-option-disagree'}>
                    <input
                      checked={form.voteSelection === 'DISAGREE'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="DISAGREE"
                    />
                    <span className="vote-optionIcon"><ThumbDownIcon size={16} /></span>
                    <span>Disagree</span>
                  </label>

                  <label className={form.voteSelection === 'FLAG' ? 'vote-option vote-option-flag is-selected' : 'vote-option vote-option-flag'}>
                    <input
                      checked={form.voteSelection === 'FLAG'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="FLAG"
                    />
                    <span className="vote-optionIcon"><FlagIcon size={16} /></span>
                    <span>Flag for Revision</span>
                  </label>
                </div>

                <input
                  className="justification-input"
                  disabled={isReadOnlyMode}
                  onChange={(e) => updateForm(card.queueId, { voteReason: e.target.value })}
                  placeholder="Structural validation justification text lines..."
                  type="text"
                  value={form.voteReason}
                />

                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button className="btn-submit-ballot" disabled={isReadOnlyMode} onClick={() => handleVoteSubmit(card)} type="button" style={{ flex: 1, margin: 0 }}>
                    Submit Live Ballot
                  </button>
                  {isDevModeActive && (
                    <button 
                      type="button" 
                      onClick={() => setOpenDrawerByCard(prev => ({ ...prev, [card.queueId]: !isDrawerOpen }))}
                      style={{ background: isDrawerOpen ? '#1e293b' : '#334155', border: '1px solid #475569', color: '#38bdf8', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', outline: 'none' }}
                    >
                      {isDrawerOpen ? '📊 Hide Analytics' : '📊 Show Analytics'}
                    </button>
                  )}
                           {isDevModeActive && isDrawerOpen && (
                <div className="sandbox-analytics-drawer" style={{ background: '#0f172a', border: '1px solid #334155', borderTop: 'none', padding: '16px', borderRadius: '0 0 6px 6px', margin: '16px -16px -16px -16px', boxSizing: 'border-box' }}>
                  <h5 style={{ margin: '0 0 10px', fontSize: '12px', color: '#38bdf8', letterSpacing: '0.05em', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>📊 JURY CONSENSUS & REPUTATION ANALYTICS</h5>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '11px' }}>
                    
                    {/* SECTION 1: CORE MATH */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <strong style={{ color: '#38bdf8', fontSize: '10px', letterSpacing: '0.05em' }}>CORE VOTING & QUORUM COEFFICIENTS</strong>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155' }}>
                        <span style={{ color: '#f8fafc', fontWeight: '500' }}>Peer Votes Tallies</span>
                        <strong>
                          <span style={{ color: '#22c55e' }}>{agreeCount} A</span> /{' '}
                          <span style={{ color: '#ef4444' }}>{disagreeCount} D</span> /{' '}
                          <span style={{ color: '#eab308' }}>{flagCount} F</span>
                        </strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155' }}>
                        <span style={{ color: '#f8fafc', fontWeight: '500' }}>Dynamic Quorum Target</span>
                        <strong style={{ color: '#a5b4fc' }}>{quorumTarget} Votes (Trust-Weighted)</strong>
                      </div>
                      <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: '4px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f8fafc', fontWeight: '500' }}>Relative Consensus Margin</span>
                          <strong style={{ color: '#38bdf8' }}>{currentConsensus.toFixed(1)}%</strong>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${currentConsensus}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)', transition: 'width 300ms ease' }} />
                        </div>
                      </div>
                    </div>
 
                    {/* SECTION 2: REPUTATION & ESCALATION */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <strong style={{ color: '#38bdf8', fontSize: '10px', letterSpacing: '0.05em' }}>REPUTATION DELTA & ESCALATION TRACE</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155', gap: '4px' }}>
                        <span style={{ color: '#a5b4fc', fontSize: '9px', fontWeight: 'bold' }}>USER REPUTATION IMPACT PREDICTOR</span>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f8fafc', fontWeight: '500' }}>If Published</span>
                          <strong style={{ color: '#22c55e' }}>{currentTrust} -&gt; {trustIfPublished}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f8fafc', fontWeight: '500' }}>If Rejected</span>
                          <strong style={{ color: '#ef4444' }}>{currentTrust} -&gt; {trustIfRejected}</strong>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155', color: '#fca5a5' }}>
                        <span style={{ color: '#fecaca', fontWeight: '500' }}>Automated System Escalation</span>
                        <strong>15% Rejection Margin</strong>
                      </div>
                    </div>
 
                  </div>
                </div>
              )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {queue.length > queuePageSize && (
        <div className="moderation-paginationRow">
          <nav className="paginationMini" aria-label="Moderation queue pagination">
            <button
              type="button"
              disabled={safeQueuePage <= 1}
              onClick={() => setQueuePage((current) => Math.max(1, current - 1))}
              className="paginationButton"
              aria-label="Previous queue page"
            >
              <ArrowLeftIcon size={17} strokeWidth={2.4} />
            </button>
            <span className="paginationText" aria-live="polite">
              {safeQueuePage} / {totalQueuePages}
            </span>
            <button
              type="button"
              disabled={safeQueuePage >= totalQueuePages}
              onClick={() => setQueuePage((current) => Math.min(totalQueuePages, current + 1))}
              className="paginationButton"
              aria-label="Next queue page"
            >
              <ArrowRightIcon size={17} strokeWidth={2.4} />
            </button>
          </nav>
        </div>
      )}

      <section className={isArchiveOpen ? 'mod-archive is-open' : 'mod-archive'}>
        <button
          type="button"
          className="mod-archiveToggle"
          onClick={() => setIsArchiveOpen((current) => !current)}
          aria-expanded={isArchiveOpen}
          aria-controls="moderation-archive-panel"
        >
          <span className="mod-archiveToggleTitle">Ballot Archive</span>
          <span className="mod-archiveToggleMeta">{ballotArchive.length} records</span>
          <span className={isArchiveOpen ? 'mod-archiveChevron is-open' : 'mod-archiveChevron'}><ArrowRightIcon size={16} /></span>
        </button>
        <div id="moderation-archive-panel" className={isArchiveOpen ? 'mod-archivePanel is-open' : 'mod-archivePanel'}>
          {ballotArchive.length === 0 ? (
            <p className="emptyState">No moderation history yet.</p>
          ) : (
            <>
              <div className="mod-archiveTableWrap">
                <table className="mod-archiveTable">
                  <thead>
                    <tr>
                      <th>Ballot</th>
                      <th>Your Vote</th>
                      <th>Status</th>
                      <th>Date Voted</th>
                      <th>Reviewer</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ballotArchive.map((entry) => (
                      <tr key={entry.queueId}>
                        <td>{entry.title}</td>
                        <td>{entry.userVote}</td>
                        <td>{entry.status}</td>
                        <td>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.votedAt))}</td>
                        <td>{entry.reviewer}</td>
                        <td>
                          {entry.sourceUrl ? (
                            <a className="mod-archiveAction" href={entry.sourceUrl} rel="noreferrer" target="_blank">View</a>
                          ) : (
                            <span className="mod-archiveAction is-disabled">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mod-archiveCards">
                {ballotArchive.map((entry) => (
                  <article className="mod-archiveCard" key={`card-${entry.queueId}`}>
                    <h4>{entry.title}</h4>
                    <p><strong>Vote:</strong> {entry.userVote}</p>
                    <p><strong>Status:</strong> {entry.status}</p>
                    <p><strong>Date:</strong> {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.votedAt))}</p>
                    <p><strong>Reviewer:</strong> {entry.reviewer}</p>
                    {entry.sourceUrl ? <a className="mod-archiveAction" href={entry.sourceUrl} rel="noreferrer" target="_blank">View Details</a> : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {traceLogs.length > 0 && (
        <div className="moderation-toggleRow">
          <label className="toggle-switch" aria-hidden="false">
            <span className="toggle-label">Show Moderation Trace Monitor</span>
            <input
              type="checkbox"
              checked={showTraceMonitor}
              onChange={(e) => setShowTraceMonitor(e.target.checked)}
              aria-label="Show Moderation Trace Monitor"
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      )}

      {showTraceMonitor && traceLogs.length > 0 && (
        <div className="terminal-audit-console">
          <div className="terminal-titlebar">Moderation Trace Monitor</div>
          <div className="terminal-screen">
            {traceLogs.slice(0, 8).map((log, index) => (
              <p className="terminal-line" key={`${log}-${index}`}>{log}</p>
            ))}
          </div>
        </div>
      )}

      {isAdminMode && (
        <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px dashed var(--line-strong)' }}>
          <div className="mod-header mod-header--admin">
            <div className="mod-header-copy">
              <div className="mod-header-titleRow">
                <span className="mod-header-icon"><AlertTriangleIcon size={20} /></span>
                <div>
                  <h2 className="ty-section-title">System Admin Arbitration Adjudication Queue</h2>
                  <p className="ty-body">Exposes deadlocked or timed-out tickets with vote weight distributions for immediate admin overrides.</p>
                </div>
              </div>
            </div>
          </div>

          {escalatedLoading ? (
            <ModerationCardsSkeleton count={1} />
          ) : (
          <div className="queue-deck" style={{ marginTop: '20px' }}>
            {escalatedQueue.length === 0 && (
              <div className="review-card" style={{ background: '#ffffff', border: '1px dashed #dbe5ea', width: '100%' }}>
                <p className="emptyState">No escalated or deadlocked cards require admin overrides.</p>
              </div>
            )}

            {escalatedQueue.map((card) => {
              const form = getForm(card.queueId);
              const activeStage = getLifecycleStageIndex(card.queueStatus);

              return (
                <div className="review-card" key={card.queueId} style={{ borderLeft: '4px solid var(--ph-gold)', width: '100%', boxSizing: 'border-box' }}>
                  <p><strong>Contributor:</strong> <span className="anonymized-tag">Anonymized Peer</span></p>
                  {card.queueStatus === 'APPEALED_PENDING' && (
                    <p style={{ margin: '0 0 10px' }}>
                      <span style={{
                        background: '#fee2e2',
                        border: '1px solid #fca5a5',
                        borderRadius: '999px',
                        color: '#991b1b',
                        display: 'inline-flex',
                        fontFamily: 'var(--mono, monospace)',
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        padding: '5px 10px',
                      }}>
                        APPEALED PENDING
                      </span>
                    </p>
                  )}
                  <p><strong>Queue ID:</strong> {card.queueId}</p>
                  <p><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
                  <p>
                    <strong>Source Link:</strong>{' '}
                    <a href={card.sourceUrl} rel="noreferrer" target="_blank">{card.sourceUrl}</a>
                  </p>
                  {card.impactSummary && <div className="summary-box" style={{ borderLeftColor: 'var(--ph-gold)' }}>"{card.impactSummary}"</div>}

                  <div className="detailsBlock" style={{ marginTop: '4px', background: '#fffbeb', borderColor: '#fef3c7' }}>
                    <h5 className="ty-label" style={{ margin: 0 }}>Adjudication Lifecycle</h5>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
                        {STAGES.map((stage, index) => (
                          <span
                            key={`${card.queueId}-admin-${stage}`}
                            style={{
                              textAlign: 'center',
                              padding: '6px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid #d1d5db',
                              background: index <= activeStage ? '#d97706' : '#f8fafc',
                              color: index <= activeStage ? '#ffffff' : '#64748b',
                              transition: 'all 220ms ease',
                            }}
                          >
                            {stage.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                      <p className="ty-meta" style={{ margin: 0, color: 'var(--ph-gold)' }}>
                        Current status: <strong>{card.queueStatus}</strong> ({card.queueStatus === 'APPEALED_PENDING' ? 'Post-publish appeal awaiting administrator adjudication' : 'Escalated to Administrator override'})
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #dbe5ea', fontSize: '13px', display: 'flex', justifyContent: 'space-around' }}>
                    <div>Community Agree Weight: <strong style={{ color: '#16a34a' }}>{card.agreeSum}</strong></div>
                    <div>Community Disagree Weight: <strong style={{ color: '#dc2626' }}>{card.disagreeSum}</strong></div>
                  </div>

                  <div className="ballot-console">
                    <h4 className="ty-card-title" style={{ margin: 0 }}>Admin Override Resolution</h4>
                    
                    <input
                      className="justification-input"
                      onChange={(e) => updateForm(card.queueId, { voteReason: e.target.value })}
                      placeholder="Administrative override justification reason (REQUIRED)..."
                      type="text"
                      value={form.voteReason}
                      style={{ border: '1px solid var(--ph-gold)' }}
                    />

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        className="btn-submit-ballot"
                        onClick={() => handleAdminOverride(card.queueId, 'PUBLISHED')}
                        type="button"
                        style={{ background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)' }}
                      >
                        Publish Override
                      </button>
                      <button
                        className="btn-submit-ballot"
                        onClick={() => handleAdminOverride(card.queueId, 'REJECTED')}
                        type="button"
                        style={{ background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)' }}
                      >
                        Reject Override
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
}
