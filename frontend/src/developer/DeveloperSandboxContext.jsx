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
