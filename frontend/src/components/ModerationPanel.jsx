import React, { useState, useEffect } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext'; 

export default function ModerationPanel() {
  const [queue, setQueue] = useState([]);
  const [voteSelection, setVoteSelection] = useState('AGREE'); 
  const [voteReason, setVoteReason] = useState('');
  const [traceLogs, setTraceLogs] = useState([]);

  // Read developer switch states safely
  const sandboxContext = useDeveloperSandbox() || {};
  const isDevModeActive = sandboxContext.isDevModeActive || false;
  const manipulatedUser = sandboxContext.manipulatedUser || null;
  const setManipulatedUser = sandboxContext.setManipulatedUser;
  const injectedQueue = sandboxContext.injectedQueue || [];
  const setInjectedQueue = sandboxContext.setInjectedQueue;
  const voteWeight = sandboxContext.voteWeight || 1;

  // Determine active constraints derived from role override selection
  const isReadOnlyMode = isDevModeActive && manipulatedUser && manipulatedUser.role === 'CONTRIBUTOR';

  const fetchQueue = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/moderation/pending');
      const data = await res.json();
      setQueue(data);
    } catch (err) {
      console.error('Failed to update review queue:', err);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  // Combine live database queue with your in-memory sandbox array entries dynamically
  const displayedQueue = [...injectedQueue, ...queue];

  const handleVoteSubmit = async (submissionId) => {
    // 🛡️ STATUS SECURITY GATE
    if (isDevModeActive && manipulatedUser && manipulatedUser.status === 'SUSPENDED') {
      setTraceLogs(prev => [`[SECURITY BLOCK] 🛑 Locked out user "${manipulatedUser.name}" from voting. Status: SUSPENDED.`, ...prev]);
      return;
    }

    // 🛡️ ROLE INTERCEPTOR GATE
    if (isDevModeActive && manipulatedUser && manipulatedUser.role === 'CONTRIBUTOR') {
      setTraceLogs(prev => [`[SECURITY BLOCK] 🛑 Locked out user "${manipulatedUser.name}" from voting. Role: CONTRIBUTOR (Restricted Read-Only).`, ...prev]);
      return;
    }

    // Locating tracking entities across displayed vs mock memory arrays
    const targetCard = displayedQueue.find(card => card.submissionId === submissionId);
    const isMockCard = injectedQueue.some(card => card.submissionId === submissionId);

    if (isMockCard && targetCard) {
      const userWeight = voteWeight;
      const currentAgree = targetCard.backgroundAgreeWeight || 0;
      const currentDisagree = targetCard.backgroundDisagreeWeight || 0;

      if (voteSelection === 'AGREE') {
        const totalAgree = currentAgree + userWeight;
        const threshold = targetCard.consensusTargetThreshold || 10;

        if (totalAgree >= threshold) {
          setTraceLogs(prev => [
            `[MODULE 3 EVENT] ⚡ Consensus reached: PUBLISHED. Applied +5.00 Trust Balance bonus to user "${manipulatedUser.name}".`,
            `[CONVERGENCE TRACE] User weight (${userWeight}) + Background Agree (${currentAgree}) = ${totalAgree} Aggregate. Target (${threshold}) CROSSED. [BYPASSED SUPABASE COMMIT]`,
            ...prev
          ]);
          
          // Dynamic state update: Boost trust score on-screen to prove Module 3 tracking functions live!
          if (setManipulatedUser) {
            setManipulatedUser(prev => ({
              ...prev,
              trustScore: Math.min(100, prev.trustScore + 5)
            }));
          }
        } else {
          setTraceLogs(prev => [`[SIMULATING] Added weight ${userWeight}. Total Agree is now ${totalAgree}/${threshold}. Consensus still pending...`, ...prev]);
        }
      } else {
        setTraceLogs(prev => [`[SIMULATING] Cast DISAGREE with weight ${userWeight}. Total Disagree: ${currentDisagree + userWeight}.`, ...prev]);
      }

      // Flush card out of memory queue since verification lifecycle is completed
      if (setInjectedQueue) {
        setInjectedQueue(prev => prev.filter(c => c.submissionId !== submissionId));
      }
      setVoteReason('');
      return;
    }

    const payload = { 
      queueId: submissionId, 
      peerId: "88bc8912-43ba-4abc-882a-ef92481aa323", 
      voteSelection, 
      voteReason 
    };

    try {
      const res = await fetch('http://localhost:8080/api/moderation/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const trace = await res.json();
        setTraceLogs(prev => [
          `[CALC TRACE] ${isDevModeActive ? manipulatedUser.name : trace.peerName} voted ${voteSelection}. Weight derived: ${isDevModeActive ? (manipulatedUser.trustScore >= 90 ? 5 : 1) : trace.derivedWeight}. Outcome: ${trace.finalOutcomeStatus}`,
          ...prev
        ]);
        setVoteReason('');
        fetchQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="moderation-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>⚖️ Asynchronous Judicial Moderation Engine</h2>

      {traceLogs.length > 0 && (
        <div style={{ background: '#1e293b', color: '#34d399', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', marginBottom: '20px' }}>
          {traceLogs.map((log, index) => <p key={index} style={{ margin: '4px 0' }}>{log}</p>)}
        </div>
      )}

      <div className="queue-deck" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {displayedQueue.map((card) => {
          const isMock = injectedQueue.some(c => c.submissionId === card.submissionId);
          
          return (
            <div 
              key={card.submissionId} 
              className="review-card" 
              style={{ 
                border: isMock ? '2px dashed #f59e0b' : isDevModeActive ? '2px dashed #38bdf8' : '1px solid #cbd5e1', 
                padding: '16px', 
                borderRadius: '8px', 
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              {isDevModeActive && manipulatedUser ? (
                <div style={{ background: isMock ? '#78350f' : '#0c4a6e', padding: '10px', borderRadius: '4px', marginBottom: '10px', color: '#fff' }}>
                  <p style={{ color: isMock ? '#fbbf24' : '#38bdf8', margin: 0, fontWeight: 'bold' }}>
                    {isMock ? '⚙️ [DEV SIMULATOR - INJECTED MOCK CARD]' : '⚙️ [DEV MODE ACTIVE - LIVE BACKEND DATA]'}
                  </p>
                  <p style={{ margin: '4px 0 0 0' }}><strong>Acting Reviewer:</strong> {manipulatedUser.name}</p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: isMock ? '#fde68a' : '#94a3b8' }}>*Bio override:* "{manipulatedUser.biography}"</p>
                </div>
              ) : (
                <p><strong>Contributor:</strong> <span className="anonymized-tag">🛡️ Anonymized Peer</span></p>
              )}

              <p style={{ fontSize: '14px', margin: '6px 0' }}><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
              <p style={{ fontSize: '14px', margin: '6px 0' }}><strong>Source Link:</strong> <a href={card.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{card.sourceUrl}</a></p>
              {card.impactSummary && <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>"{card.impactSummary}"</p>}
              
              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '12px', paddingTop: '12px' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Cast Evaluation Ballot</p>
                
                {isReadOnlyMode && (
                  <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                    ⚠️ Access Denied: Contributor accounts are restricted to Read-Only mode.
                  </div>
                )}

                <div className="vote-options" style={{ margin: '12px 0', display: 'flex', gap: '16px' }}>
                  <label style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer', fontWeight: '600', color: isReadOnlyMode ? '#94a3b8' : '#16a34a' }}>
                    <input 
                      type="radio" 
                      name={`vote-live-${card.submissionId}`} 
                      value="AGREE"
                      disabled={isReadOnlyMode}
                      checked={voteSelection === 'AGREE'} 
                      onChange={(e) => setVoteSelection(e.target.value)} 
                      style={{ marginRight: '6px', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                    /> 
                    AGREE
                  </label>

                  <label style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer', fontWeight: '600', color: isReadOnlyMode ? '#94a3b8' : '#dc2626' }}>
                    <input 
                      type="radio" 
                      name={`vote-live-${card.submissionId}`} 
                      value="DISAGREE"
                      disabled={isReadOnlyMode}
                      checked={voteSelection === 'DISAGREE'} 
                      onChange={(e) => setVoteSelection(e.target.value)} 
                      style={{ marginRight: '6px', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                    /> 
                    DISAGREE
                  </label>
                </div>

                <input 
                  type="text" 
                  placeholder={isReadOnlyMode ? "Evaluation input disabled (Read-Only Mode)..." : "Structural validation justification text lines..."} 
                  value={voteReason} 
                  disabled={isReadOnlyMode}
                  onChange={(e) => setVoteReason(e.target.value)} 
                  style={{ width: '100%', padding: '8px', margin: '10px 0', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: isReadOnlyMode ? 'not-allowed' : 'auto' }} 
                />
                
                <button 
                  onClick={() => handleVoteSubmit(card.submissionId)} 
                  disabled={isReadOnlyMode}
                  style={{ 
                    padding: '8px 16px', 
                    background: isReadOnlyMode ? '#94a3b8' : '#2563eb', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: isReadOnlyMode ? 'not-allowed' : 'pointer', 
                    fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
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
