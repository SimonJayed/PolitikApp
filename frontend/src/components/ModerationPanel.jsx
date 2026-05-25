import { useEffect, useMemo, useState } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const STAGES = ['SUBMITTED', 'JURY_REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED'];

function stageIndexFor(queueStatus) {
  switch ((queueStatus || '').toUpperCase()) {
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

export default function ModerationPanel() {
  const [queue, setQueue] = useState([]);
  const [traceLogs, setTraceLogs] = useState([]);
  const [formByCard, setFormByCard] = useState({});

  const sandboxContext = useDeveloperSandbox() || {};
  const isDevModeActive = sandboxContext.isDevModeActive || false;
  const manipulatedUser = sandboxContext.manipulatedUser || null;
  const voteWeight = sandboxContext.voteWeight || 1;

  const isReadOnlyMode = isDevModeActive && manipulatedUser && manipulatedUser.role === 'CONTRIBUTOR';

  useEffect(() => {
    fetchQueue();
  }, []);

  async function fetchQueue() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/pending`);
      const data = await res.json();
      setQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to update review queue:', err);
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
      peerId: '88bc8912-43ba-4abc-882a-ef92481aa323',
      voteSelection: form.voteSelection,
      voteReason: form.voteReason,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/moderation/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    </div>
  );
}
