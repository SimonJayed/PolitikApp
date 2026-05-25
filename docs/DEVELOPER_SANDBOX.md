# Developer Sandbox Mode (Mocking User Attributes)

## 🎛️ Sandbox Layout & Window Behavior
To ensure a clean, intuitive testing layout, the developer tools are split into two separate operational windows to decouple user session profile spoofing from system mock data generation:
* **🟢 Control Anchor Dock:** The sandbox mounts a persistent control bar onto the bottom-right corner of the viewport frame. This panel contains independent toggle buttons to launch or collapse specific simulation utilities on command.
* **👤 Session Profile Spoofer Modal:** A dedicated utility view focused entirely on *acting identity hijacking*. It tracks user profile name inputs, bio text strings, numeric range sliders, and active statuses to override the current session's permissions instantly without account re-authentication.
* **📥 Mock Data Injection Control Modal:** An isolated operations view focusing purely on *application data simulation*. It allows testers to independently push randomized review ballot card payloads directly into the local frontend memory loop array to simulate incoming traffic conditions.
* **Modal-Level Scrolling:** Each modular tool container utilizes standard vertical flex segments. Textareas dynamically compute sizing rows based on string length to eliminate layout-trapping internal field scrollbars. If aggregate tool contents exceed height boundaries, the main modal body scales seamlessly as a scrollable viewport window.

## File 1: Global State Provider
Where to store it: Create a brand new file at `frontend/src/developer/DeveloperSandboxContext.jsx`

Code to copy and paste:

```JavaScript
import React, { createContext, useContext, useState } from 'react';

const DeveloperSandboxContext = createContext();

export function DeveloperSandboxProvider({ children }) {
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [injectedQueue, setInjectedQueue] = useState([]); 

  // Track changeable mock user attributes for weight calculations
  const [manipulatedUser, setManipulatedUser] = useState({
    name: "Pedro Penduko",
    biography: "Verified Capstone Contributor Profile tracking municipal budget items.",
    trustScore: 95.0,
    status: "ACTIVE",
    role: "JUDICIAL_REVIEWER"
  });

  const injectMockCard = () => {
    const mockId = Math.random().toString(36).substring(2, 11);
    const newCard = {
      submissionId: mockId,
      politicianId: "CEBU-GOV-" + Math.floor(1000 + Math.random() * 9000),
      impactSummary: "Simulated verification check entry regarding municipal infrastructure resource allocations.",
      sourceUrl: "[https://cebucity.gov.ph/mock-data-audit-trace-](https://cebucity.gov.ph/mock-data-audit-trace-)" + mockId
    };
    setInjectedQueue(prev => [...prev, newCard]);
  };

  const clearInjectedQueue = () => setInjectedQueue([]);

  return (
    <DeveloperSandboxContext.Provider value={{ 
      isDevModeActive, 
      setIsDevModeActive, 
      manipulatedUser, 
      setManipulatedUser,
      injectedQueue,
      injectMockCard,
      clearInjectedQueue
    }}>
      {children}
    </DeveloperSandboxContext.Provider>
  );
}

export const useDeveloperSandbox = () => useContext(DeveloperSandboxContext);
```

## File 2: Floating Developer Options Toggle Panel
Where to store it: Create a brand new file at `frontend/src/developer/DeveloperOptionsPanel.jsx`

Code to copy and paste:

```JavaScript
import React, { useState } from 'react';
import { useDeveloperSandbox } from './DeveloperSandboxContext';

export default function DeveloperOptionsPanel() {
  const { 
    isDevModeActive, 
    setIsDevModeActive, 
    manipulatedUser, 
    setManipulatedUser,
    injectMockCard,
    clearInjectedQueue 
  } = useDeveloperSandbox();
  
  // Decoupled modular interface state switches
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [isLargePreset, setIsLargePreset] = useState(false);

  const bioText = manipulatedUser.biography || '';
  const bioRows = Math.max(2, Math.min(10, Math.ceil(bioText.length / 32) + (bioText.match(/\n/g) || []).length));

  if (!isDevModeActive) {
    return (
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999 }}>
        <button 
          onClick={() => setIsDevModeActive(true)}
          style={{ backgroundColor: '#4b5563', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          🛠️ Enable Developer Sandbox
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
      
      {/* 🟢 FIXED PERSISTENT CONTROL ANCHOR DOCK BAR */}
      <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', flexShrink: 0 }}>
        <button 
          onClick={() => setShowIdentityModal(!showIdentityModal)} 
          style={{ background: showIdentityModal ? '#0284c7' : '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          👤 Spoof My Session
        </button>
        <button 
          onClick={() => setShowDataModal(!showDataModal)} 
          style={{ background: showDataModal ? '#2563eb' : '#334155', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📥 Inject Data Queue
        </button>
        <button 
          onClick={() => { setIsDevModeActive(false); setShowIdentityModal(false); setShowDataModal(false); }} 
          style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ❌ Turn Off
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 👤 MODAL 1: IDENTITY & SESSION PROFILE OVERRIDE SPOOFER                    */}
      {/* ========================================================================= */}
      {showIdentityModal && (
        <div style={{ 
          background: '#0f172a', color: '#f8fafc', border: '2px solid #0284c7', borderRadius: '6px', padding: '16px', width: '320px', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <h3 style={{ margin: 0, fontSize: '13px', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>👤 Sandbox Session Profile Spoofer</h3>
          
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Session Role Override:</label>
            <select 
              value={manipulatedUser.role || 'JUDICIAL_REVIEWER'} 
              onChange={(e) => setManipulatedUser({ ...manipulatedUser, role: e.target.value })}
              style={{ width: '100%', padding: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="ADMINISTRATOR">ADMINISTRATOR (Full System Controls)</option>
              <option value="JUDICIAL_REVIEWER">JUDICIAL_REVIEWER (Module 2 Access Granted)</option>
              <option value="CONTRIBUTOR">CONTRIBUTOR (Module 2 Restricted - Read Only)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>User Display Name:</label>
            <input 
              type="text" 
              value={manipulatedUser.name} 
              onChange={(e) => setManipulatedUser({ ...manipulatedUser, name: e.target.value })}
              style={{ width: '100%', padding: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Biography String:</label>
            <textarea 
              rows={bioRows} 
              value={manipulatedUser.biography || ''} 
              onChange={(e) => setManipulatedUser({ ...manipulatedUser, biography: e.target.value })}
              style={{ width: '100%', padding: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box', height: 'auto', resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Trust Balance Score: {manipulatedUser.trustScore}%</label>
            <input 
              type="range" min="0" max="100" value={manipulatedUser.trustScore} 
              onChange={(e) => setManipulatedUser({ ...manipulatedUser, trustScore: parseFloat(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>Account Status:</label>
            <select 
              value={manipulatedUser.status} 
              onChange={(e) => setManipulatedUser({ ...manipulatedUser, status: e.target.value })}
              style={{ width: '100%', padding: '6px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: '4px', boxSizing: 'border-box' }}
            >
              <option value="ACTIVE">ACTIVE (Normal Clearing)</option>
              <option value="SUSPENDED">SUSPENDED (Security Blockout)</option>
            </select>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📥 MODAL 2: MOCK DATA INJECTION CONTROL PANEL                               */}
      {/* ========================================================================= */}
      {showDataModal && (
        <div style={{ 
          background: '#0f172a', color: '#f8fafc', border: '2px solid #2563eb', borderRadius: '6px', padding: '16px', width: '320px', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', color: '#60a5fa' }}>📥 Mock Data Injection Control</h3>
            <button
              type="button"
              onClick={() => setIsLargePreset(!isLargePreset)}
              style={{ background: '#334155', color: '#38bdf8', border: '1px solid #475569', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer' }}
            >
              {isLargePreset ? '📺 Compact' : '🖥️ Wide View'}
            </button>
          </div>

          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
            Clicking the actions below pushes simulated ballot requests directly into the local frontend memory loop state array bypassing Supabase constraints.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <button 
              type="button"
              onClick={injectMockCard}
              style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
            >
              ➕ Inject Mock Review Ballot Card
            </button>
            <button 
              type="button"
              onClick={clearInjectedQueue}
              style={{ width: '100%', padding: '8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🧹 Flush Active Mock Queue Memory Array
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
```

## File 3: Your Moderation Deck (Updated to listen to the toggle switch)
Where to store it: Replace your existing code inside frontend/src/components/ModerationPanel.jsx

Code to copy and paste:

```JavaScript
import React, { useState, useEffect } from 'react';
import { useDeveloperSandbox } from '../developer/DeveloperSandboxContext'; 

export default function ModerationPanel() {
  const [queue, setQueue] = useState([]);
  const [voteSelection, setVoteSelection] = useState('AGREE'); 
  const [voteReason, setVoteReason] = useState('');
  const [traceLogs, setTraceLogs] = useState([]);

  // Read developer switch states safely
  const sandboxContext = useDeveloperSandbox();
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false;
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null;
  const injectedQueue = sandboxContext ? sandboxContext.injectedQueue : [];

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

    // Determine if processing an in-memory simulated card asset
    const isMockCard = injectedQueue.some(card => card.submissionId === submissionId);

    if (isMockCard) {
      const derivedWeight = manipulatedUser.trustScore >= 90 ? 5 : 1;
      setTraceLogs(prev => [
        `[SIMULATED ENGINE TRACE] ${manipulatedUser.name} cast ${voteSelection} (Simulated Weight: ${derivedWeight}) on injected card ${submissionId}... Outcome: PENDING. [BYPASSED SUPABASE COMMIT]`,
        ...prev
      ]);
      setVoteReason('');
      
      if (sandboxContext && sandboxContext.setInjectedQueue) {
        sandboxContext.setInjectedQueue(prev => prev.filter(c => c.submissionId !== submissionId));
      }
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
```

## File 4: The Application Shell Frame Mount
Where to store it: Wrap your view components inside frontend/src/App.jsx

Code to copy and paste:

```JavaScript
import React, { useState } from 'react';
import { DeveloperSandboxProvider, useDeveloperSandbox } from './developer/DeveloperSandboxContext';
import DeveloperOptionsPanel from './developer/DeveloperOptionsPanel';
import ModerationPanel from './components/ModerationPanel';

function AppContent() {
  const [activeView, setActiveView] = useState('directory');

  // Read current developer options session variables safely
  const sandboxContext = useDeveloperSandbox();
  const isDevModeActive = sandboxContext ? sandboxContext.isDevModeActive : false;
  const manipulatedUser = sandboxContext ? sandboxContext.manipulatedUser : null;

  // Calculate permissions state constraint dynamically
  const currentRole = isDevModeActive && manipulatedUser ? manipulatedUser.role : 'JUDICIAL_REVIEWER';

  return (
    <div className="app-viewport-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f1f5f9' }}>
      
      {/* 🧭 ROLE-AWARE SYSTEM NAVIGATION LINK LIST */}
      <nav className="navigation-bar" style={{ display: 'flex', gap: '12px', padding: '12px 20px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
        <button onClick={() => setActiveView('directory')} style={{ padding: '6px 12px', background: activeView === 'directory' ? '#334155' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Directory</button>
        <button onClick={() => setActiveView('submit')} style={{ padding: '6px 12px', background: activeView === 'submit' ? '#334155' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Submit</button>
        <button onClick={() => setActiveView('dashboard')} style={{ padding: '6px 12px', background: activeView === 'dashboard' ? '#334155' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Dashboard</button>
        <button onClick={() => setActiveView('compare')} style={{ padding: '6px 12px', background: activeView === 'compare' ? '#334155' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Compare</button>
        
        {/* 🔒 NAVBAR CLIPPING GATE: Omit button link dynamically from DOM tree if context is CONTRIBUTOR */}
        {currentRole !== 'CONTRIBUTOR' && (
          <button 
            onClick={() => setActiveView('moderation')} 
            style={{ padding: '6px 12px', background: activeView === 'moderation' ? '#0284c7' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Moderation
          </button>
        )}
      </nav>

      {/* Main Container View Space Routing Selectors */}
      <main className="content-workspace" style={{ padding: '20px', flexGrow: 1 }}>
        {activeView === 'directory' && <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>📂 Public Directory Workspace Viewing Area</div>}
        {activeView === 'submit' && <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>✍️ Creative Event Submission Intake Hub</div>}
        {activeView === 'dashboard' && <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>📊 Operational System Metrics Summary Charts</div>}
        {activeView === 'compare' && <div style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>🔄 Cross-Reference Engine Comparison Board</div>}

        {/* 🔒 SECURITY PATH GUARD INTERCEPTOR CONTAINER */}
        {activeView === 'moderation' && (
          currentRole === 'CONTRIBUTOR' ? (
            <section className="workspace" style={{ textAlign: 'center', padding: '40px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h2 style={{ color: '#dc2626', fontSize: '24px', margin: '0 0 12px 0' }}>🛑 Access Restricted</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '15px', lineHeight: '1.5' }}>
                Contributor accounts do not have authorized clearance to view or moderate pending queue cards.
              </p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '14px', fontStyle: 'italic' }}>
                *Presentation Note: Open the floating user profile drawer spoofer to reset your Session Role Override back to JUDICIAL_REVIEWER.*
              </p>
            </section>
          ) : (
            <ModerationPanel />
          )
        )}
      </main>

      {/* Floating Split-Modal Command Workspace Anchor Bar */}
      <DeveloperOptionsPanel />
    </div>
  );
}

export default function App() {
  return (
    <DeveloperSandboxProvider>
      <AppContent />
    </DeveloperSandboxProvider>
  );
}
```

## 🔐 Role-Based Access Control (RBAC) Specification
The system enforces strict role-based presentation routing and logical execution parameters based on the active `manipulatedUser.role` state value. The table below outlines the visibility and transaction privileges across all three operational modules:

| System Access Role | Navigation Tabs Visible | Module 2 Workspace Access | Ballot Form Inputs State | Submission Interceptor Actions |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMINISTRATOR`** | Directory, Submit, Dashboard, Compare, Moderation | **GRANTED** (Full View) | **ENABLED** | Bypasses Supabase; Commits Simulated Calculation Trace |
| **`JUDICIAL_REVIEWER`**| Directory, Submit, Dashboard, Compare, Moderation | **GRANTED** (Full View) | **ENABLED** | Bypasses Supabase; Commits Simulated Calculation Trace |
| **`CONTRIBUTOR`** | Directory, Submit, Dashboard, Compare | **DENIED** (Hidden from Nav) | **LOCKED OUT** (Disabled) | Blocks transaction completely; Logs Security Lockout Trace |

### 🛠️ UI Behavior & Interception Rules
1. **Navbar Clipping:** When the user role switches to `CONTRIBUTOR`, the layout engine must remove the `moderation` link from the DOM tree entirely.
2. **Path Guard Interception:** If a user with a `CONTRIBUTOR` status attempts to manually route to `/moderation` via the browser URL address bar, the workspace panel must block layout compilation and return an inline `🛑 Access Restricted` barrier element instead.
3. **Ballot Form Lock:** Under a read-only or restricted simulation trace, any rendered ballot inputs, radio selections, and operational submit triggers must pass an HTML `disabled` state configuration matching the user context restriction flag.