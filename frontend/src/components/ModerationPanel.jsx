import { useEffect, useMemo, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const STAGES = ['SUBMITTED', 'JURY_REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED'];

function stageIndexFor(queueStatus) {
  switch ((queueStatus || '').toUpperCase()) {
    case 'SUBMITTED':
    case 'PENDING':
      return 0;
    case 'JURY_REVIEW':
      return 1;
    case 'ESCALATED':
    case 'REVISION_REQUIRED':
      return 2;
    case 'REJECTED':
      return 3;
    case 'PUBLISHED':
      return 4;
    default:
      return 0;
  }
}

export default function ModerationPanel({ token, user }) {
  const [queue, setQueue] = useState([]);
  const [traceLogs, setTraceLogs] = useState([]);
  const [formByCard, setFormByCard] = useState({});

  const sandboxContext = useDeveloperSandbox() || {};
  const isDevModeActive = sandboxContext.isDevModeActive || false;
  const manipulatedUser = sandboxContext.manipulatedUser || null;
  const voteWeight = sandboxContext.voteWeight || 1;

  const isReadOnlyMode = isDevModeActive && manipulatedUser && manipulatedUser.role === 'CONTRIBUTOR';

  const [escalatedQueue, setEscalatedQueue] = useState([]);

  useEffect(() => {
    fetchQueue();
    fetchEscalatedQueue();
  }, []);

  async function fetchQueue() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/pending`, {
        headers: { Authorization: `Bearer ${token}` }
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
    }
  }

  async function fetchEscalatedQueue() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/escalated`, {
        headers: { Authorization: `Bearer ${token}` }
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
    }
  }

  const queueDeck = useMemo(() => queue, [queue]);

  function getForm(queueId) {
    return formByCard[queueId] || { voteSelection: 'AGREE', voteReason: '' };
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Vote failed');
      }

      const trace = await res.json();
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
          Authorization: `Bearer ${token}`
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
        <div>
          <h2>Asynchronous Judicial Moderation Engine</h2>
          <p>Pending Queue cards require community jury adjudication before publication.</p>
        </div>
      </div>

      {traceLogs.length > 0 && (
        <div className="terminal-audit-console">
          <div className="terminal-titlebar">Moderation Trace Monitor</div>
          <div className="terminal-screen">
            {traceLogs.slice(0, 8).map((log, index) => (
              <p className="terminal-line" key={`${log}-${index}`}>{log}</p>
            ))}
          </div>
        </div>
      )}

      <div className="queue-deck">
        {queueDeck.length === 0 && (
          <div className="review-card">
            <p className="emptyState">No pending moderation cards in queue.</p>
          </div>
        )}

        {queueDeck.map((card) => {
          const form = getForm(card.queueId);
          const activeStage = stageIndexFor(card.queueStatus);

          return (
            <div className="review-card" key={card.queueId}>
              <p><strong>Contributor:</strong> <span className="anonymized-tag">Anonymized Peer</span></p>
              <p><strong>Queue ID:</strong> {card.queueId}</p>
              <p><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
              <p>
                <strong>Source Link:</strong>{' '}
                <a href={card.sourceUrl} rel="noreferrer" target="_blank">{card.sourceUrl}</a>
              </p>
              {card.impactSummary && <div className="summary-box">"{card.impactSummary}"</div>}

              <div className="detailsBlock" style={{ marginTop: '4px' }}>
                <h5>Edit Lifecycle</h5>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '8px' }}>
                    {STAGES.map((stage, index) => (
                      <span
                        key={`${card.queueId}-${stage}`}
                        style={{
                          textAlign: 'center',
                          padding: '6px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          border: '1px solid #d1d5db',
                          background: index <= activeStage ? '#0f766e' : '#f8fafc',
                          color: index <= activeStage ? '#ffffff' : '#64748b',
                          transition: 'all 220ms ease',
                        }}
                      >
                        {stage.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    Current status: <strong>{card.queueStatus}</strong>
                    {card.escalationFlag ? ' (Escalated to admin review)' : ''}
                  </p>
                </div>
              </div>

              <div className="ballot-console">
                <h4>Cast Evaluation Ballot</h4>

                {isReadOnlyMode && (
                  <div className="status-toast" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
                    Access Denied: Contributor accounts are restricted to Read-Only mode.
                  </div>
                )}

                <div className="vote-options">
                  <label className="text-agree">
                    <input
                      checked={form.voteSelection === 'AGREE'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="AGREE"
                    />
                    AGREE
                  </label>

                  <label className="text-disagree">
                    <input
                      checked={form.voteSelection === 'DISAGREE'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="DISAGREE"
                    />
                    DISAGREE
                  </label>

                  <label style={{ color: '#7c3aed', fontWeight: 700 }}>
                    <input
                      checked={form.voteSelection === 'FLAG'}
                      disabled={isReadOnlyMode}
                      name={`vote-${card.queueId}`}
                      onChange={(e) => updateForm(card.queueId, { voteSelection: e.target.value })}
                      type="radio"
                      value="FLAG"
                    />
                    FLAG FOR REVISION
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

                <button
                  className="btn-submit-ballot"
                  disabled={isReadOnlyMode}
                  onClick={() => handleVoteSubmit(card)}
                  type="button"
                >
                  Submit Live Ballot
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isDevModeActive && manipulatedUser && manipulatedUser.role === 'ADMIN' && (
        <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px dashed var(--line-strong)' }}>
          <div className="mod-header" style={{ background: '#fffbeb', borderColor: '#fef3c7' }}>
            <div>
              <h2 style={{ color: '#b45309' }}>👑 System Admin Arbitration Adjudication Queue</h2>
              <p style={{ color: '#b45309' }}>Exposes deadlocked or timed-out tickets with vote weight distributions for immediate admin overrides.</p>
            </div>
          </div>

          <div className="queue-deck" style={{ marginTop: '20px' }}>
            {escalatedQueue.length === 0 && (
              <div className="review-card" style={{ background: '#ffffff', border: '1px dashed #dbe5ea', width: '100%' }}>
                <p className="emptyState">No escalated or deadlocked cards require admin overrides.</p>
              </div>
            )}

            {escalatedQueue.map((card) => {
              const form = getForm(card.queueId);
              const activeStage = stageIndexFor(card.queueStatus);

              return (
                <div className="review-card" key={card.queueId} style={{ borderLeft: '4px solid #f59e0b', width: '100%', boxSizing: 'border-box' }}>
                  <p><strong>Contributor:</strong> <span className="anonymized-tag">Anonymized Peer</span></p>
                  <p><strong>Queue ID:</strong> {card.queueId}</p>
                  <p><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
                  <p>
                    <strong>Source Link:</strong>{' '}
                    <a href={card.sourceUrl} rel="noreferrer" target="_blank">{card.sourceUrl}</a>
                  </p>
                  {card.impactSummary && <div className="summary-box" style={{ borderLeftColor: '#f59e0b' }}>"{card.impactSummary}"</div>}

                  <div className="detailsBlock" style={{ marginTop: '4px', background: '#fffbeb', borderColor: '#fef3c7' }}>
                    <h5>Adjudication Lifecycle</h5>
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
                      <p style={{ margin: 0, fontSize: '12px', color: '#b45309' }}>
                        Current status: <strong>{card.queueStatus}</strong> (Escalated to Administrator override)
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #dbe5ea', fontSize: '13px', display: 'flex', justifyContent: 'space-around' }}>
                    <div>Community Agree Weight: <strong style={{ color: '#16a34a' }}>{card.agreeSum}</strong></div>
                    <div>Community Disagree Weight: <strong style={{ color: '#dc2626' }}>{card.disagreeSum}</strong></div>
                  </div>

                  <div className="ballot-console">
                    <h4>Admin Override Resolution</h4>
                    
                    <input
                      className="justification-input"
                      onChange={(e) => updateForm(card.queueId, { voteReason: e.target.value })}
                      placeholder="Administrative override justification reason (REQUIRED)..."
                      type="text"
                      value={form.voteReason}
                      style={{ border: '1px solid #f59e0b' }}
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
        </div>
      )}
    </div>
  );
}
