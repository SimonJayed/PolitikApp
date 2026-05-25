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
          background: '#0f172a', color: '#f8fafc', border: '2px solid #2563eb', borderRadius: '6px', padding: '16px', width: isLargePreset ? '480px' : '320px', boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
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
