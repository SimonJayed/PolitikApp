import { useMemo, useState } from 'react';
import { DeveloperSandboxContext } from './DeveloperSandboxContext';

const DEFAULT_PROFILE_METRICS = {
  contributorSubmissions: 14,
  contributorApproved: 12,
  contributorRejected: 2,
  reviewerConsensusVotes: 25,
  reviewerDissentVotes: 3,
  reviewerTotalBallots: 28,
  adminInterventions: 7,
  adminTieBreakerActive: true,
  adminTimeoutOverrideActive: true,
};

function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return min;
  }
  return Math.min(max, Math.max(min, numberValue));
}

export function DeveloperSandboxProvider({ children }) {
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [injectedQueue, setInjectedQueue] = useState([]); 
  const [profileMetrics, setProfileMetrics] = useState(DEFAULT_PROFILE_METRICS);

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

  const contributorRejectionRate = profileMetrics.contributorSubmissions > 0
    ? (profileMetrics.contributorRejected / profileMetrics.contributorSubmissions) * 100
    : 0;

  const effectiveManipulatedUser = useMemo(() => (
    contributorRejectionRate > 15
      ? { ...manipulatedUser, status: 'SUSPENDED' }
      : manipulatedUser
  ), [contributorRejectionRate, manipulatedUser]);
  const voteWeight = getSimulatedVoteWeight();

  function updateProfileMetric(key, value) {
    setProfileMetrics((current) => ({
      ...current,
      [key]: typeof current[key] === 'boolean' ? Boolean(value) : clampNumber(value),
    }));
  }

  function simulateApprovedSubmission() {
    setProfileMetrics((current) => ({
      ...current,
      contributorSubmissions: current.contributorSubmissions + 1,
      contributorApproved: current.contributorApproved + 1,
    }));
  }

  function simulateRejectedSubmission() {
    setProfileMetrics((current) => ({
      ...current,
      contributorSubmissions: current.contributorSubmissions + 1,
      contributorRejected: current.contributorRejected + 1,
    }));
  }

  function simulateConsensusVote() {
    setProfileMetrics((current) => ({
      ...current,
      reviewerConsensusVotes: current.reviewerConsensusVotes + 1,
      reviewerTotalBallots: current.reviewerTotalBallots + 1,
    }));
    setManipulatedUser((current) => ({
      ...current,
      trustScore: clampNumber((current.trustScore || 0) + 5, 0, 100),
    }));
  }

  function simulateDissentVote() {
    setProfileMetrics((current) => ({
      ...current,
      reviewerDissentVotes: current.reviewerDissentVotes + 1,
      reviewerTotalBallots: current.reviewerTotalBallots + 1,
    }));
    setManipulatedUser((current) => ({
      ...current,
      trustScore: clampNumber((current.trustScore || 0) - 5, 0, 100),
    }));
  }

  function adjustAdminInterventions(delta) {
    setProfileMetrics((current) => ({
      ...current,
      adminInterventions: clampNumber(current.adminInterventions + delta),
    }));
  }

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

  const sandboxValue = useMemo(() => ({
      isDevModeActive, 
      setIsDevModeActive, 
      manipulatedUser: effectiveManipulatedUser, 
      setManipulatedUser,
      injectedQueue,
      setInjectedQueue,
      injectMockCard,
      clearInjectedQueue,
      voteWeight,
      profileMetrics,
      setProfileMetrics,
      updateProfileMetric,
      contributorRejectionRate,
      simulateApprovedSubmission,
      simulateRejectedSubmission,
      simulateConsensusVote,
      simulateDissentVote,
      adjustAdminInterventions,
    }), [
      isDevModeActive,
      effectiveManipulatedUser,
      injectedQueue,
      profileMetrics,
      contributorRejectionRate,
      voteWeight,
    ]);

  return (
    <DeveloperSandboxContext.Provider value={sandboxValue}>
      {children}
    </DeveloperSandboxContext.Provider>
  );
}
