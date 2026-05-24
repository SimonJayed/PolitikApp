import React, { useState, useEffect } from 'react';

const mockReviewers = [
  { id: '88bc8912-43ba-4abc-882a-ef92481aa323', name: 'Pedro Penduko', weight: 5, trust: 95.0 },
  { id: '77bc8912-32ba-4abc-992a-ef92481aa322', name: 'Jose Rizal', weight: 1, trust: 80.0 },
  { id: '99bc8912-53ba-4abc-772a-ef92481aa324', name: 'Juan Tamad', weight: 5, trust: 98.0 }
];

export default function ModerationPanel() {
  const [activeTab, setActiveTab] = useState('deck'); // 'deck' or 'sandbox'
  const [queue, setQueue] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(mockReviewers[0]);
  const [voteSelection, setVoteSelection] = useState('AGREE');
  const [voteReason, setVoteReason] = useState('');
  const [traceLogs, setTraceLogs] = useState([]);

  // --- In-Memory Sandbox Core State Hooks ---
  const [sandboxVotes, setSandboxVotes] = useState([]);
  const [customPeerName, setCustomPeerName] = useState('');
  const [customPeerTrust, setCustomPeerTrust] = useState(85.0);

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

  const handleVoteSubmit = async (queueId) => {
    if (!voteReason.trim()) return alert('Please enter a justification description text lines.');

    const payload = { queueId, peerId: selectedReviewer.id, voteSelection, voteReason };

    try {
      const res = await fetch('http://localhost:8080/api/moderation/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const trace = await res.json();
        setTraceLogs(prev => [
          `[LIVE ENGINE TRACE] ${trace.peerName} cast ${trace.voteSelection} (Derived Weight: ${trace.derivedWeight}). Current aggregates: AGREE=${trace.totalAgreeWeight}, DISAGREE=${trace.totalDisagreeWeight}. Mathematical Status: ${trace.finalOutcomeStatus}`,
          ...prev
        ]);
        setVoteReason('');
        fetchQueue();
      }
    } catch (err) {
      console.error('Error submitting ballot payload:', err);
    }
  };

  // --- Sandbox Pure In-Memory Formula Calculations ---
  const handleAddSandboxVote = (selection) => {
    if (!customPeerName.trim()) return alert('Please input a simulated reviewer name first.');
    const derivedWeight = customPeerTrust >= 90.0 ? 5 : 1;
    const newVote = { name: customPeerName, trust: customPeerTrust, weight: derivedWeight, selection };
    
    const updatedVotes = [...sandboxVotes, newVote];
    setSandboxVotes(updatedVotes);

    let agreeSum = 0;
    let disagreeSum = 0;
    updatedVotes.forEach(v => v.selection === 'AGREE' ? agreeSum += v.weight : disagreeSum += v.weight);

    let calculatedStatus = "PENDING CONSENSUS";
    if (agreeSum >= 10 && agreeSum >= disagreeSum * 2) calculatedStatus = "CONVERGED [STATUS: PUBLISHED]";
    if (disagreeSum >= 10 && disagreeSum >= agreeSum * 2) calculatedStatus = "CONVERGED [STATUS: REJECTED]";

    setTraceLogs(prev => [
      `[SANDBOX ENGINE] ${customPeerName} logged ${selection} (Weight Metric derived: ${derivedWeight}). Combined Vector Totals -> AGREE: ${agreeSum}/10, DISAGREE: ${disagreeSum}/10. Current Formula standing: ${calculatedStatus}`,
      ...prev
    ]);
    setCustomPeerName('');
  };

  return (
    <div className="moderation-container">
      {/* Dynamic Workspace Tab Selection Switches */}
      <div className="sandbox-tab-row">
        <button className={`tab-btn ${activeTab === 'deck' ? 'active' : ''}`} onClick={() => setActiveTab('deck')}>⚖️ Real Moderation Deck</button>
        <button className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`} onClick={() => setActiveTab('sandbox')}>🛠️ Developer Math Sandbox</button>
      </div>

      {/* Shared Arithmetic Diagnostic Output Shell Console */}
      {traceLogs.length > 0 && (
        <div className="terminal-audit-console">
          <div className="terminal-titlebar">🔍 ARITHMETIC DIAGNOSTICS: SYSTEM CALCULATION TRACER</div>
          <div className="terminal-screen">
            {traceLogs.map((log, index) => <p key={index} className="terminal-line line-checked">{log}</p>)}
          </div>
        </div>
      )}

      {activeTab === 'deck' ? (
        <div className="queue-deck">
          {queue.length === 0 ? (
            <div className="empty-state">No pending entries requiring peer review validation.</div>
          ) : (
            queue.map((card) => (
              <div key={card.submissionId} className="review-card">
                <h3>Target Politician Reference: {card.politicianId.substring(0, 8)}...</h3>
                <p><strong>Contributor Identity:</strong> <span className="anonymized-tag">🛡️ Anonymized Peer</span></p>
                <div className="summary-box"><em>"{card.impactSummary}"</em></div>

                <div className="ballot-console">
                  <h4>Cast Real Evaluation Ballot</h4>
                  <select onChange={(e) => setSelectedReviewer(mockReviewers[e.target.value])} className="reviewer-select">
                    {mockReviewers.map((r, idx) => <option key={r.id} value={idx}>{r.name} (Trust: {r.trust}% → Weight: {r.weight})</option>)}
                  </select>
                  <div className="vote-options">
                    <label><input type="radio" name={`vote-live-${card.submissionId}`} checked={voteSelection === 'AGREE'} onChange={() => setVoteSelection('AGREE')} /> <span className="text-agree">AGREE</span></label>
                    <label><input type="radio" name={`vote-live-${card.submissionId}`} checked={voteSelection === 'DISAGREE'} onChange={() => setVoteSelection('DISAGREE')} /> <span className="text-disagree">DISAGREE</span></label>
                  </div>
                  <input type="text" placeholder="Structural validation justification text lines..." value={voteReason} onChange={(e) => setVoteReason(e.target.value)} className="justification-input" />
                  <button className="btn-submit-ballot" onClick={() => handleVoteSubmit(card.submissionId)}>Submit Live Ballot</button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="sandbox-workspace">
          <div className="review-card">
            <h3>🛠️ In-Memory Formula Simulator Workspace</h3>
            <p>Simulate consensus threshold ratios ($A \ge 10 \land A \ge 2D$) in real-time without modifying Supabase server profiles.</p>
            
            <div className="sandbox-form-group">
              <input type="text" placeholder="Simulated Peer Reviewer Name (e.g., Andres Bonifacio)" value={customPeerName} onChange={(e) => setCustomPeerName(e.target.value)} className="justification-input" />
              <label style={{display: 'block', marginTop: '10px', color: '#4b5563', fontWeight: '600'}}>Simulated Contributor Trust Score: {customPeerTrust}% (Score &ge; 90 scales weight to 5)</label>
              <input type="range" min="0" max="100" value={customPeerTrust} onChange={(e) => setCustomPeerTrust(parseFloat(e.target.value))} className="sandbox-slider" />
            </div>

            <div className="sandbox-action-buttons">
              <button className="btn-submit-ballot bg-agree" onClick={() => handleAddSandboxVote('AGREE')}>Simulate AGREE Ballot</button>
              <button className="btn-submit-ballot bg-disagree" onClick={() => handleAddSandboxVote('DISAGREE')}>Simulate DISAGREE Ballot</button>
            </div>
            <button className="btn-escalate" style={{marginTop: '16px', border: 'none', background: '#374151', color: '#fff', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600'}} onClick={() => { setSandboxVotes([]); setTraceLogs([]); }}>Reset Sandbox Values</button>
          </div>
        </div>
      )}
    </div>
  );
}
