import { useEffect, useMemo, useState } from 'react';
import { DeveloperSandboxContext } from './DeveloperSandboxContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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

const ROLE_DEFAULT_METRICS = {
  CONTRIBUTOR: {
    contributorSubmissions: 14,
    contributorApproved: 12,
    contributorRejected: 2,
  },
  JUDICIAL_REVIEWER: {
    reviewerConsensusVotes: 25,
    reviewerDissentVotes: 3,
    reviewerTotalBallots: 28,
  },
  PEER: {
    reviewerConsensusVotes: 25,
    reviewerDissentVotes: 3,
    reviewerTotalBallots: 28,
  },
  ADMIN: {
    adminInterventions: 7,
    adminTieBreakerActive: true,
    adminTimeoutOverrideActive: true,
  },
  ADMINISTRATOR: {
    adminInterventions: 7,
    adminTieBreakerActive: true,
    adminTimeoutOverrideActive: true,
  }
};

function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return min;
  }
  return Math.min(max, Math.max(min, numberValue));
}

export function DeveloperSandboxProvider({ children, currentUser, token }) {
  const [isDevModeActive, setIsDevModeActive] = useState(false);
  const [injectedQueue, setInjectedQueue] = useState([]); 
  const [profileMetrics, setProfileMetrics] = useState(DEFAULT_PROFILE_METRICS);

  // Sync actual user and metrics dynamically when sandbox is enabled
  useEffect(() => {
    if (isDevModeActive && currentUser) {
      let mappedRole = currentUser.role || "JUDICIAL_REVIEWER";
      if (mappedRole === "PEER") {
        mappedRole = "JUDICIAL_REVIEWER";
      } else if (mappedRole === "ADMINISTRATOR") {
        mappedRole = "ADMIN";
      }

      setManipulatedUser({
        name: currentUser.fullName || currentUser.name || "Pedro Penduko",
        biography: currentUser.biography || "Verified Capstone Contributor Profile tracking municipal budget items.",
        trustScore: currentUser.trustScore !== undefined ? currentUser.trustScore : 95.0,
        status: currentUser.accountStatus || currentUser.status || "ACTIVE",
        role: mappedRole
      });

      if (currentUser.userId) {
        fetch(`${API_BASE_URL}/api/submissions/contributor/${currentUser.userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(res => {
            if (!res.ok) throw new Error("Fetch failed");
            return res.json();
          })
          .then(data => {
            const entries = Array.isArray(data) ? data : [];
            const submissions = entries.length;
            const approved = entries.filter((e) => e.status === 'PUBLISHED').length;
            const rejected = entries.filter((e) => e.status === 'REJECTED').length;

            setProfileMetrics(current => ({
              ...current,
              contributorSubmissions: submissions,
              contributorApproved: approved,
              contributorRejected: rejected,
            }));
          })
          .catch(err => console.error("Sandbox failing to pre-fetch contributor stats:", err));
      }
    }
  }, [isDevModeActive, currentUser, token]);

  // Track changeable mock user attributes for Module 3 simulations
  const [manipulatedUser, setManipulatedUser] = useState({
    name: "Pedro Penduko",
    biography: "Verified Capstone Contributor Profile tracking municipal budget items.",
    trustScore: 95.0,
    status: "ACTIVE",
    role: "JUDICIAL_REVIEWER"
  });

  // Sync profile metrics preset when the spoofed role changes
  useEffect(() => {
    const roleKey = manipulatedUser.role;
    if (roleKey && ROLE_DEFAULT_METRICS[roleKey]) {
      setProfileMetrics((current) => ({
        ...current,
        ...ROLE_DEFAULT_METRICS[roleKey]
      }));
    }
  }, [manipulatedUser.role]);

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
