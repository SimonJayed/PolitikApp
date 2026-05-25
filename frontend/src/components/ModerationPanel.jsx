import React, { useState, useEffect } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext';

const mockReviewers = [
  { id: '88bc8912-43ba-4abc-882a-ef92481aa323', name: 'Pedro Penduko', weight: 5, trust: 95.0 },
  { id: '77bc8912-32ba-4abc-992a-ef92481aa322', name: 'Jose Rizal', weight: 1, trust: 80.0 },
  { id: '99bc8912-53ba-4abc-772a-ef92481aa324', name: 'Juan Tamad', weight: 5, trust: 98.0 }
];

export default function ModerationPanel() {
  const [queue, setQueue] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(mockReviewers[0]);
  const [voteSelection, setVoteSelection] = useState('AGREE');
  const [voteReason, setVoteReason] = useState('');
  const [traceLogs, setTraceLogs] = useState([]);

  // Consume global Developer Sandbox Context
  const sandboxContext = useDeveloperSandbox();
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false;
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null;
  const injectedQueue = sandboxContext ? sandboxContext.injectedQueue : [];
  const setInjectedQueue = sandboxContext ? sandboxContext.setInjectedQueue : null;

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

  useEffect(() => {
    fetchQueue();
  }, []);

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

    if (!voteReason.trim()) {
      return alert('Please enter a justification description text lines.');
    }

    // In-Memory Injection Voting Interceptor Gate (Supabase Commit Bypass)
    const isInjectedCard = injectedQueue.some(card => card.submissionId === submissionId);
    if (isInjectedCard) {
      const reviewerName = manipulatedUser ? manipulatedUser.name : 'Anonymous Peer';
      const reviewerWeight = manipulatedUser 
        ? (manipulatedUser.trustScore >= 90.0 ? 5 : 1) 
        : 1;

      setTraceLogs(prev => [
        `[SIMULATED ENGINE TRACE] ${reviewerName} cast ${voteSelection} (Simulated Weight: ${reviewerWeight}) on injected card ${submissionId.substring(0, 8)}... Outcome: PENDING. [BYPASSED SUPABASE COMMIT]`,
        ...prev
      ]);

      // Dynamic Filter: Cleanly remove mock card from in-memory queue context
      if (setInjectedQueue) {
        setInjectedQueue(prev => prev.filter(card => card.submissionId !== submissionId));
      }
      
      setVoteReason('');
      return; // Intercept and bypass Supabase database transaction commits!
    }

    // Dynamic Peer ID: If dev options is active, use Pedro's ID as the acting mock peer, otherwise standard selection
    const peerId = isDevModeActive ? '88bc8912-43ba-4abc-882a-ef92481aa323' : selectedReviewer.id;

    const payload = {
      queueId: submissionId, // Backend maps submissionId directly in payload
      peerId,
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
        
        // Dynamic logs depending on active developer switch
        const reviewerName = isDevModeActive ? manipulatedUser.name : trace.peerName;
        const reviewerWeight = isDevModeActive 
          ? (manipulatedUser.trustScore >= 90.0 ? 5 : 1) 
          : trace.derivedWeight;

        setTraceLogs(prev => [
          `[LIVE ENGINE TRACE] ${reviewerName} cast ${voteSelection} (Derived Weight: ${reviewerWeight}). Current aggregates: AGREE=${trace.totalAgreeWeight}, DISAGREE=${trace.totalDisagreeWeight}. Mathematical Status: ${trace.finalOutcomeStatus}`,
          ...prev
        ]);
        
        setVoteReason('');
        fetchQueue();
      }
    } catch (err) {
      console.error('Error submitting ballot payload:', err);
    }
  };

  // Combine live database queue with your in-memory sandbox array entries dynamically
  const displayedQueue = [...injectedQueue, ...queue];

  return (
    <div className="moderation-container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>⚖️ Asynchronous Judicial Moderation Engine</h2>

      {/* Shared Arithmetic Diagnostic Output Shell Console */}
      {traceLogs.length > 0 && (
        <div className="terminal-audit-console" style={{ background: '#1e293b', color: '#34d399', padding: '12px', borderRadius: '6px', fontFamily: 'monospace', marginBottom: '20px' }}>
          <div className="terminal-titlebar" style={{ borderBottom: '1px solid #334155', paddingBottom: '6px', marginBottom: '8px', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
            🔍 ARITHMETIC DIAGNOSTICS: SYSTEM CALCULATION TRACER
          </div>
          <div className="terminal-screen">
            {traceLogs.map((log, index) => (
              <p key={index} className="terminal-line line-checked" style={{ margin: '4px 0', fontSize: '13px' }}>{log}</p>
            ))}
          </div>
        </div>
      )}

      <div className="queue-deck" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {displayedQueue.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
            No pending entries requiring peer review validation.
          </div>
        ) : (
          displayedQueue.map((card) => {
            const isMock = injectedQueue.some(mc => mc.submissionId === card.submissionId);
            return (
              <div 
                key={card.submissionId} 
                className="review-card" 
                style={{ 
                  border: isMock ? '2px dashed #f59e0b' : isDevModeActive ? '2px dashed #38bdf8' : '1px solid #cbd5e1', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {/* Dynamic Card Labels depending entirely on Dev Options switch status */}
                {isDevModeActive && manipulatedUser ? (
                  <div style={{ background: isMock ? '#78350f' : '#0c4a6e', padding: '10px', borderRadius: '4px', marginBottom: '10px', color: '#fff' }}>
                    <p style={{ color: isMock ? '#fbbf24' : '#38bdf8', margin: 0, fontWeight: 'bold' }}>
                      {isMock ? '⚙️ [DEV SIMULATOR - INJECTED MOCK CARD]' : '⚙️ [DEV MODE ACTIVE - LIVE BACKEND DATA]'}
                    </p>
                    <p style={{ margin: '4px 0 0 0' }}><strong>Acting Reviewer:</strong> {manipulatedUser.name}</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: isMock ? '#fde68a' : '#cbd5e1' }}>*Bio override:* "{manipulatedUser.biography}"</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: isMock ? '#cbd5e1' : '#cbd5e1' }}>*Active Trust Score:* {manipulatedUser.trustScore}% (Derived Weight: {manipulatedUser.trustScore >= 90.0 ? 5 : 1})</p>
                  </div>
                ) : (
                  <p><strong>Contributor:</strong> <span className="anonymized-tag">🛡️ Anonymized Peer</span></p>
                )}

                <p style={{ fontSize: '14px', margin: '6px 0' }}><strong>Target Reference:</strong> {card.politicianId || 'SYSTEM-MAIN-TRACK'}</p>
                <p style={{ fontSize: '14px', margin: '6px 0' }}><strong>Source Link:</strong> <a href={card.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{card.sourceUrl}</a></p>
                {card.impactSummary && <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '8px', borderRadius: '4px' }}>"{card.impactSummary}"</p>}

                <div className="ballot-console" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Cast Evaluation Ballot</p>
                  
                  {isReadOnlyMode && (
                    <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', padding: '8px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px' }}>
                      ⚠️ Access Denied: Contributor accounts are restricted to Read-Only mode.
                    </div>
                  )}

                  {isDevModeActive ? (
                    <p style={{ margin: '10px 0', color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
                      Standard reviewer selector disabled. Sandbox mock properties will be used to process this ballot.
                    </p>
                  ) : (
                    <select 
                      onChange={(e) => setSelectedReviewer(mockReviewers[e.target.value])} 
                      className="reviewer-select"
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '12px' }}
                    >
                      {mockReviewers.map((r, idx) => (
                        <option key={r.id} value={idx}>
                          {r.name} (Trust: {r.trust}% → Weight: {r.weight})
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="vote-options" style={{ margin: '12px 0', display: 'flex', gap: '16px' }}>
                    <label style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer', fontWeight: '600', color: isReadOnlyMode ? '#94a3b8' : '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="radio" 
                        name={`vote-live-${card.submissionId}`} 
                        value="AGREE"
                        checked={voteSelection === 'AGREE'} 
                        onChange={() => setVoteSelection('AGREE')} 
                        disabled={isReadOnlyMode}
                        style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                      /> 
                      AGREE
                    </label>

                    <label style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer', fontWeight: '600', color: isReadOnlyMode ? '#94a3b8' : '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input 
                        type="radio" 
                        name={`vote-live-${card.submissionId}`} 
                        value="DISAGREE"
                        checked={voteSelection === 'DISAGREE'} 
                        onChange={() => setVoteSelection('DISAGREE')} 
                        disabled={isReadOnlyMode}
                        style={{ cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
                      /> 
                      DISAGREE
                    </label>
                  </div>

                  <input 
                    type="text" 
                    placeholder={isReadOnlyMode ? "Evaluation input disabled (Read-Only Mode)..." : "Structural validation justification text lines..."} 
                    value={voteReason} 
                    onChange={(e) => setVoteReason(e.target.value)} 
                    className="justification-input" 
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '12px', boxSizing: 'border-box', cursor: isReadOnlyMode ? 'not-allowed' : 'auto' }}
                    disabled={isReadOnlyMode}
                  />
                  
                  <button 
                    className="btn-submit-ballot" 
                    onClick={() => handleVoteSubmit(card.submissionId)}
                    disabled={isReadOnlyMode}
                    style={{ 
                      padding: '10px 16px', 
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
          })
        )}
      </div>
    </div>
  );
}
