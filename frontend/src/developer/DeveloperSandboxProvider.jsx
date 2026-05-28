import { useEffect, useMemo, useState } from 'react';
import { DeveloperSandboxContext } from './DeveloperSandboxContext';
import { clampTrustScore, getTrustVoteWeight } from '../components/trustScore';

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

function mapRoleForSandbox(role) {
  if (role === "PEER") {
    return "JUDICIAL_REVIEWER";
  }
  if (role === "ADMINISTRATOR") {
    return "ADMIN";
  }
  return role || "JUDICIAL_REVIEWER";
}

function normalizeSandboxMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => {
      if (typeof DEFAULT_PROFILE_METRICS[key] === 'boolean') {
        return [key, Boolean(value)];
      }
      return [key, clampNumber(value)];
    })
  );
}

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
  const [manipulatedUser, setManipulatedUser] = useState({
    name: "Pedro Penduko",
    biography: "Verified Capstone Contributor Profile tracking municipal budget items.",
    trustScore: 100.0,
    status: "ACTIVE",
    role: "JUDICIAL_REVIEWER"
  });

  function applyPersistedSandboxProfile(userProfile) {
    if (!userProfile) return;
    setManipulatedUser({
      name: userProfile.fullName || userProfile.name || "Pedro Penduko",
      biography: userProfile.biography || "Verified Capstone Contributor Profile tracking municipal budget items.",
      trustScore: userProfile.trustScore !== undefined ? userProfile.trustScore : 100.0,
      status: userProfile.accountStatus || userProfile.status || "ACTIVE",
      role: mapRoleForSandbox(userProfile.role)
    });

    const savedMetrics = normalizeSandboxMetrics(userProfile.sandboxProfileMetrics);
    if (Object.keys(savedMetrics).length > 0) {
      setProfileMetrics((current) => ({
        ...current,
        ...savedMetrics,
      }));
    }
  }

  // Sync actual user and metrics dynamically when sandbox is enabled
  useEffect(() => {
    if (isDevModeActive && currentUser) {
      applyPersistedSandboxProfile(currentUser);

      const savedMetrics = normalizeSandboxMetrics(currentUser.sandboxProfileMetrics);
      const hasSavedMetrics = Object.keys(savedMetrics).length > 0;
      if (hasSavedMetrics) {
        setProfileMetrics(current => ({
          ...current,
          ...savedMetrics,
        }));
      }

      if (currentUser.userId && !hasSavedMetrics) {
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

  // Sync profile metrics preset when the spoofed role changes
  useEffect(() => {
    const roleKey = manipulatedUser.role;
    if (roleKey && ROLE_DEFAULT_METRICS[roleKey]) {
      setProfileMetrics((current) => ({
        ...ROLE_DEFAULT_METRICS[roleKey],
        ...current
      }));
    }
  }, [manipulatedUser.role]);

  // 🧮 Compute voting weight dynamically based on SRS trust thresholds
  const getSimulatedVoteWeight = () => {
    return getTrustVoteWeight(manipulatedUser.trustScore);
  };

  const contributorRejectionRate = profileMetrics.contributorSubmissions > 0
    ? (profileMetrics.contributorRejected / profileMetrics.contributorSubmissions) * 100
    : 0;

  const effectiveManipulatedUser = manipulatedUser;
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
      trustScore: clampTrustScore((current.trustScore || 0) + 5),
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
      trustScore: clampTrustScore((current.trustScore || 0) - 5),
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
      applyPersistedSandboxProfile,
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
