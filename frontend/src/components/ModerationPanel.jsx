import { useEffect, useMemo, useRef, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';
import { clampTrustScore } from './trustScore';
import { getLifecycleStageIndex } from './LifecycleStageStrip';
import ModerationQueueDashboard from './module2/ModerationQueueDashboard';
import './module2/Module2.css';

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
    let cancelled = false;
    async function loadArchive() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/moderation/archive`, {
          headers: getSandboxHeaders(),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data)) {
          const mapped = data.map((entry) => ({
            queueId: entry.queueId,
            title: entry.title,
            userVote: entry.userVote,
            status: entry.status,
            votedAt: entry.votedAt,
            reviewer: (isDevModeActive ? manipulatedUser?.name : user?.fullName) || 'Reviewer',
            sourceUrl: entry.sourceUrl || '',
          }));
          setBallotArchive(mapped);
          return;
        }
      } catch {
        // fallback to local cache
      }

      try {
        const saved = localStorage.getItem(archiveStorageKey);
        if (!saved || cancelled) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setBallotArchive(parsed);
      } catch {
        // ignore localStorage errors
      }
    }
    loadArchive();
    return () => {
      cancelled = true;
    };
  }, [archiveStorageKey, isDevModeActive, manipulatedUser?.name, token, user?.fullName]);

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

  const votedQueueIds = useMemo(
    () => new Set(ballotArchive.map((entry) => String(entry.queueId))),
    [ballotArchive],
  );

  const visibleQueue = useMemo(
    () => combinedQueue.filter((card) => !votedQueueIds.has(String(card.queueId))),
    [combinedQueue, votedQueueIds],
  );

  const totalQueuePages = Math.max(1, Math.ceil(visibleQueue.length / queuePageSize));
  const safeQueuePage = Math.min(queuePage, totalQueuePages);
  const queueDeck = useMemo(
    () => visibleQueue.slice((safeQueuePage - 1) * queuePageSize, safeQueuePage * queuePageSize),
    [visibleQueue, safeQueuePage],
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

    if (!user?.userId && !isDevModeActive) {
      setTraceLogs((prev) => [`[ERROR] Unable to submit ballot: missing authenticated user ID.`, ...prev]);
      return;
    }

    const payload = {
      queueId: card.queueId,
      peerId: user?.userId,
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
      setQueue((current) => current.filter((item) => item.queueId !== card.queueId));
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
    <ModerationQueueDashboard
      queueLoading={queueLoading}
      queueDeck={queueDeck}
      isDevModeActive={isDevModeActive}
      handleSandboxShiftStage={handleSandboxShiftStage}
      openDrawerByCard={openDrawerByCard}
      setOpenDrawerByCard={setOpenDrawerByCard}
      openDetailsByCard={openDetailsByCard}
      setOpenDetailsByCard={setOpenDetailsByCard}
      manipulatedUser={manipulatedUser}
      user={user}
      voteWeight={voteWeight}
      isReadOnlyMode={isReadOnlyMode}
      getForm={getForm}
      updateForm={updateForm}
      handleVoteSubmit={handleVoteSubmit}
      visibleQueue={visibleQueue}
      queuePageSize={queuePageSize}
      safeQueuePage={safeQueuePage}
      totalQueuePages={totalQueuePages}
      setQueuePage={setQueuePage}
      isArchiveOpen={isArchiveOpen}
      setIsArchiveOpen={setIsArchiveOpen}
      ballotArchive={ballotArchive}
      traceLogs={traceLogs}
      showTraceMonitor={showTraceMonitor}
      setShowTraceMonitor={setShowTraceMonitor}
      isAdminMode={isAdminMode}
      escalatedQueue={escalatedQueue}
      escalatedLoading={escalatedLoading}
      handleAdminOverride={handleAdminOverride}
    />
  );
}
