import React, { useEffect, useState } from 'react';
import PeerVotingWeightDetail from './PeerVotingWeightDetail';
import { LedgerFilterTabs } from './ContributorPenaltyDashboard';
import WeightedConsensusPanel from './WeightedConsensusPanel';
import VotingWeightAlert from './VotingWeightAlert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function readApiResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }
  return payload;
}

export default function PeerVotingWeightDashboard({
  consensusRate,
  metrics,
  simulateConsensusVote,
  simulateDissentVote,
  tier,
  trustScore,
  isSandboxMode = false,
  token,
  user,
}) {
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerState, setLedgerState] = useState({ status: 'loading', message: 'Loading ledger entries...' });

  useEffect(() => {
    let ignore = false;

    if (!user?.userId) {
      setLedgerEntries([]);
      setLedgerState({ status: 'error', message: 'Unable to load database ledger records without a user id.' });
      return () => {
        ignore = true;
      };
    }

    setLedgerState({ status: 'loading', message: 'Loading ledger entries...' });
    fetch(`${API_BASE_URL}/api/submissions/contributor/${user.userId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(readApiResponse)
      .then((data) => {
        if (ignore) return;
        const entries = Array.isArray(data) ? data : [];
        setLedgerEntries(entries);
        setLedgerState({
          status: 'success',
          message: entries.length > 0 ? '' : 'No database ledger records found.',
        });
      })
      .catch((error) => {
        if (ignore) return;
        setLedgerEntries([]);
        setLedgerState({ status: 'error', message: error.message || 'Could not load database ledger records.' });
      });

    return () => {
      ignore = true;
    };
  }, [token, user?.userId]);

  return (
    <>
      <VotingWeightAlert tier={tier} trustScore={trustScore} />

      <PeerVotingWeightDetail
        tier={tier}
        trustScore={trustScore}
        consensusVotes={metrics.reviewerConsensusVotes}
        dissentVotes={metrics.reviewerDissentVotes}
        consensusRate={consensusRate}
      />

      {isSandboxMode && (
        <WeightedConsensusPanel
          tier={tier}
          consensusRate={consensusRate}
        />
      )}

      <LedgerFilterTabs entries={ledgerEntries} state={ledgerState} />

      {isSandboxMode && (
        <section className="matrixActionPanel">
          <div>
            <h3 className="ty-card-title">Consensus Score Simulator</h3>
            <p className="ty-body">SRS Section 3.2 thresholds recalculate instantly as trust changes.</p>
          </div>
          <div className="matrixActionRow">
            <button onClick={simulateConsensusVote} type="button">+ Sim Consensus Vote</button>
            <button className="dangerButton" onClick={simulateDissentVote} type="button">+ Sim Dissenting Vote</button>
          </div>
        </section>
      )}
    </>
  );
}
