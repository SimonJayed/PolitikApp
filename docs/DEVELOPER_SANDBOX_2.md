# Developer Sandbox Mode — Part 2 (Module 3 Consensus & Trust Score Simulation)

> [!IMPORTANT]
> **CROSS-REFERENCE DISCLAIMER & TESTING NOTICE:**
> This document is Part 2 of the PolitikApp Developer Sandboxing Suite. It details advanced multi-user crowd simulation, voter weight multipliers, and automated reputation scoring routines. This file **MUST** be referenced and implemented alongside `docs/DEVELOPER_SANDBOX.md` to ensure global context synchronization and prevent client-side compilation failures.

---

## ⚖️ Module 3: Cross-Module Consensus & Trust Score Simulation
To easily showcase the distributed jury model and dynamic reputation adjustments to instructors without executing multiple physical account authentications mid-presentation, the sandbox features an interactive client-side **Jury Consensus Vector Simulator** inside the Mock Data Injection modal drawer.

This engine completely simulates the event-driven postconditions of your Spring Boot backend's `ConsensusReachedEvent` directly within frontend memory loops.

### 🧮 Active Vote Weight Derivation Matrix
In strict compliance with **SRS Section 3.2 (UC-3.2)**, an acting user's voting weight multiplier scales fluidly based on their simulated **Trust Balance Score** parameter managed inside the Identity Spoofer modal:
* **High-Trust Tier ($\ge$ 90% Trust Score):** Ballot Weight Multiplier = `5`
* **Standard Tier (70% - 89.9% Trust Score):** Ballot Weight Multiplier = `3`
* **Unverified/Low-Trust Tier (Below 70% Trust Score):** Ballot Weight Multiplier = `1`

---

## 📋 Synchronized Component Verification Implementations

### File 1: Extended Global State Provider
Where to store it: Append or replace your state hooks inside `frontend/src/developer/DeveloperSandboxContext.jsx`

```JavaScript
import React, { createContext, useContext, useState } from 'react';

const DeveloperSandboxContext = createContext();

export function DeveloperSandboxProvider({ children }) {
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [injectedQueue, setInjectedQueue] = useState([]); 

  // Track changeable mock user attributes for Module 3 simulations
  const [manipulatedUser, setManipulatedUser] = useState({
    name: "Pedro Penduko",
    biography: "Verified Capstone Contributor Profile tracking municipal budget items.",
    trustScore: 95.0,
    status: "ACTIVE",
    role: "JUDICIAL_REVIEWER"
  });

  // 🧮 Compute voting weight dynamically based on SRS trust thresholds
  const getSimulatedVoteWeight = () => {
    if (manipulatedUser.trustScore >= 90) return 5;
    if (manipulatedUser.trustScore >= 70) return 3;
    return 1;
  };

  const injectMockCard = () => {
    const mockId = Math.random().toString(36).substring(2, 11);
    const newCard = {
      submissionId: mockId,
      politicianId: "CEBU-GOV-" + Math.floor(1000 + Math.random() * 9000),
      impactSummary: "Simulated infrastructure verification audit checking public record allocations.",
      sourceUrl: "https://cebucity.gov.ph/mock-audit-" + mockId,
      // Pre-allocated community jury vector (Simulates existing background user activity)
      backgroundAgreeWeight: 6,
      backgroundDisagreeWeight: 2,
      consensusTargetThreshold: 10
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
      setInjectedQueue,
      injectMockCard,
      clearInjectedQueue,
      voteWeight: getSimulatedVoteWeight()
    }}>
      {children}
    </DeveloperSandboxContext.Provider>
  );
}

export const useDeveloperSandbox = () => useContext(DeveloperSandboxContext);
```

### File 2: Identity Spoofer Slider UI Overlay
Where to store it: Embed inside the Trust Score section of `frontend/src/developer/DeveloperOptionsPanel.jsx`. Ensure you extract your fields via destructuring from the context custom hook at the top of your component definition (`const { manipulatedUser, setManipulatedUser, voteWeight } = useDeveloperSandbox();`).

```JavaScript
<div>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
    <label>Trust Balance Score: <strong style={{ color: '#34d399' }}>{manipulatedUser.trustScore}%</strong></label>
    <span>Vote Weight: <strong style={{ color: '#38bdf8' }}>x{voteWeight}</strong></span>
  </div>
  <input 
    type="range" min="0" max="100" value={manipulatedUser.trustScore} 
    onChange={(e) => setManipulatedUser({ ...manipulatedUser, trustScore: parseFloat(e.target.value) })}
    style={{ width: '100%', cursor: 'pointer' }}
  />
</div>
```

### File 3: Consensus Trigger & Reputation Adjuster
Where to store it: Replace the `handleVoteSubmit` execution block inside `frontend/src/components/ModerationPanel.jsx`. Ensure your initialization lines at the top of your component pull down the active destructuring parameters hook cleanly:
`const { isDevModeActive, manipulatedUser, setManipulatedUser, injectedQueue, setInjectedQueue, voteWeight } = useDeveloperSandbox();`

```JavaScript
const handleVoteSubmit = async (submissionId) => {
  if (isDevModeActive && manipulatedUser && manipulatedUser.status === 'SUSPENDED') {
    setTraceLogs(prev => [`[SECURITY BLOCK] 🛑 Locked out user from voting. Status: SUSPENDED.`, ...prev]);
    return;
  }

  // Locating tracking entities across displayed vs mock memory arrays
  const targetCard = displayedQueue.find(card => card.submissionId === submissionId);
  const isMockCard = injectedQueue.some(card => card.submissionId === submissionId);

  if (isMockCard && targetCard) {
    const userWeight = voteWeight;
    const currentAgree = targetCard.backgroundAgreeWeight;
    const currentDisagree = targetCard.backgroundDisagreeWeight;

    if (voteSelection === 'AGREE') {
      const totalAgree = currentAgree + userWeight;
      const threshold = targetCard.consensusTargetThreshold;

      if (totalAgree >= threshold) {
        setTraceLogs(prev => [
          `[MODULE 3 EVENT] ⚡ Consensus reached: PUBLISHED. Applied +5.00 Trust Balance bonus to user "${manipulatedUser.name}".`,
          `[CONVERGENCE TRACE] User weight (${userWeight}) + Background Agree (${currentAgree}) = ${totalAgree} Aggregate. Target (${threshold}) CROSSED. [BYPASSED SUPABASE COMMIT]`,
          ...prev
        ]);
        
        // Dynamic state update: Boost trust score on-screen to prove Module 3 tracking functions live!
        setManipulatedUser(prev => ({
          ...prev,
          trustScore: Math.min(100, prev.trustScore + 5)
        }));
      } else {
        setTraceLogs(prev => [`[SIMULATING] Added weight ${userWeight}. Total Agree is now ${totalAgree}/${threshold}. Consensus still pending...`, ...prev]);
      }
    } else {
      setTraceLogs(prev => [`[SIMULATING] Cast DISAGREE with weight ${userWeight}. Total Disagree: ${currentDisagree + userWeight}.`, ...prev]);
    }

    // Flush card out of memory queue since verification lifecycle is completed
    setInjectedQueue(prev => prev.filter(c => c.submissionId !== submissionId));
    return;
  }
};
```