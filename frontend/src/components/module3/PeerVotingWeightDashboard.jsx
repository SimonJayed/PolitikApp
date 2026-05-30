import React, { useEffect, useState, useMemo } from 'react';
import PeerVotingWeightDetail from './PeerVotingWeightDetail';
import WeightedConsensusPanel from './WeightedConsensusPanel';
import VotingWeightAlert from './VotingWeightAlert';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatLedgerDate(value) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

async function readApiResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed.');
  }
  return payload;
}

function PeerReviewerLedger({ entries, state }) {
  const [activeTab, setActiveTab] = useState('ALL');
  const filteredEntries = useMemo(() => {
    if (activeTab === 'ALL') return entries;
    return entries.filter(e => String(e.userVote || '').toUpperCase() === activeTab);
  }, [activeTab, entries]);

  const tabs = [
    { key: 'ALL', label: 'ALL BALLOTS' },
    { key: 'AGREE', label: 'AGREE BALLOTS' },
    { key: 'DISAGREE', label: 'DISAGREE BALLOTS' },
    { key: 'FLAG', label: 'FLAGGED BALLOTS' },
  ];

  return (
    <section className="ledgerPanel" aria-label="Jury ballot archive ledger">
      <div className="ledgerFilterSection">
        <span className="ledgerFilterLabel">Ballot filtering:</span>
        <div className="ledgerFilterTabs" role="tablist" aria-label="Ballot filters">
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? 'active' : ''}
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {state?.status === 'loading' && (
        <div className="ledgerEmptyState">Loading jury ballot ledger...</div>
      )}

      {state?.status !== 'loading' && filteredEntries.length === 0 && (
        <div className="ledgerEmptyState">{state?.message || 'No ballots found matching this filter.'}</div>
      )}

      {state?.status !== 'loading' && filteredEntries.length > 0 && (
        <div className="ledgerEntryList">
          {filteredEntries.map((entry) => {
            const voteStr = String(entry.userVote || '').toUpperCase();
            const statusStr = String(entry.status || '').toUpperCase();
            
            // Determine alignment outcome status
            const isTerminal = statusStr === 'PUBLISHED' || statusStr === 'REJECTED';
            const isAligned = (voteStr === 'AGREE' && statusStr === 'PUBLISHED') || 
                              (voteStr === 'DISAGREE' && statusStr === 'REJECTED');
            
            let alignmentLabel = "⏳ Awaiting Consensus";
            let alignmentTone = "standard";
            if (isTerminal) {
              alignmentLabel = isAligned ? "✓ Consensus Aligned" : "✕ Dissenting Voice";
              alignmentTone = isAligned ? "success" : "danger";
            }

            return (
              <article className="ledgerEntry" key={entry.queueId || Math.random()}>
                <div className="ledgerEntryTopline">
                  <span className={`ledgerTypeBadge ${voteStr.toLowerCase() === 'agree' ? 'project' : voteStr.toLowerCase() === 'disagree' ? 'audit' : 'legislation'}`}>
                    CAST: {voteStr}
                  </span>
                  <span>{formatLedgerDate(entry.votedAt)}</span>
                </div>
                <strong>{String(entry.title || 'Double-Blind Review Item').replaceAll('_', ' ')}</strong>
                <div className="ledgerEntryMeta">
                  <span className={`ledgerTypeBadge ${statusStr === 'PUBLISHED' ? 'project' : statusStr === 'REJECTED' ? 'audit' : 'legislation'}`} style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                    STATUS: {statusStr}
                  </span>
                  <span className={`ledgerTypeBadge ${alignmentTone}`} style={{ fontWeight: '700' }}>
                    {alignmentLabel}
                  </span>
                </div>
                {entry.sourceUrl && (
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ marginTop: '4px' }}>
                    🔗 Verified Source URL ↗
                  </a>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
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
    fetch(`${API_BASE_URL}/api/moderation/archive`, {
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
      <VotingWeightAlert tier={tier} trustScore={trustScore} weight={metrics?.voteWeight} />

      <PeerVotingWeightDetail
        tier={tier}
        trustScore={trustScore}
        consensusVotes={metrics.reviewerConsensusVotes}
        dissentVotes={metrics.reviewerDissentVotes}
        consensusRate={consensusRate}
        weight={metrics.voteWeight}
      />

      {isSandboxMode && (
        <WeightedConsensusPanel
          tier={tier}
          consensusRate={consensusRate}
        />
      )}

      <PeerReviewerLedger entries={ledgerEntries} state={ledgerState} />

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
