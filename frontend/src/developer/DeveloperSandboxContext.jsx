import React, { createContext, useContext, useState } from 'react';

const DeveloperSandboxContext = createContext();

export function DeveloperSandboxProvider({ children }) {
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [injectedQueue, setInjectedQueue] = useState([]); 

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
      sourceUrl: "https://cebucity.gov.ph/mock-data-audit-trace-" + mockId
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
      clearInjectedQueue
    }}>
      {children}
    </DeveloperSandboxContext.Provider>
  );
}

export const useDeveloperSandbox = () => useContext(DeveloperSandboxContext);
