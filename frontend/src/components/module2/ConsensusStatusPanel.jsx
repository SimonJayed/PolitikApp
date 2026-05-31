import React from 'react';

export default function ConsensusStatusPanel({
  card,
  isDevModeActive,
  voteWeight = 1,
  manipulatedUser,
  user,
}) {
  if (!card) return null;

  const hashCharSum = String(card.queueId || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const agreeCount = (hashCharSum % 7) + 1;
  const disagreeCount = (hashCharSum % 3);
  const flagCount = (hashCharSum % 2);
  const totalVotes = agreeCount + disagreeCount + flagCount;

  const quorumTarget = (hashCharSum % 4) + 4;
  const currentConsensus = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;

  const currentTrust = isDevModeActive && manipulatedUser ? (manipulatedUser?.trustScore ?? 100) : (user?.trustScore ?? 100);
  const trustIfPublished = Math.min(500, currentTrust + 15.00).toFixed(2);
  const trustIfRejected = Math.max(0, currentTrust - 20.00).toFixed(2);

  return (
    <div className="sandbox-analytics-drawer" style={{ background: '#0f172a', border: '1px solid #334155', padding: '16px', borderRadius: '6px', margin: '12px 0 0' }}>
      <h5 style={{ margin: '0 0 10px', fontSize: '12px', color: '#38bdf8', letterSpacing: '0.05em', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
        📊 JURY CONSENSUS & REPUTATION ANALYTICS
      </h5>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '11px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <strong style={{ color: '#38bdf8', fontSize: '10px', letterSpacing: '0.05em' }}>CORE VOTING & QUORUM COEFFICIENTS</strong>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155' }}>
            <span style={{ color: '#f8fafc', fontWeight: '500' }}>Peer Votes Tallies</span>
            <strong>
              <span style={{ color: '#22c55e' }}>{agreeCount} A</span> /{' '}
              <span style={{ color: '#ef4444' }}>{disagreeCount} D</span> /{' '}
              <span style={{ color: '#eab308' }}>{flagCount} F</span>
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155' }}>
            <span style={{ color: '#f8fafc', fontWeight: '500' }}>Dynamic Quorum Target</span>
            <strong style={{ color: '#a5b4fc' }}>{quorumTarget} Votes (Trust-Weighted)</strong>
          </div>
          <div style={{ background: '#1e293b', padding: '8px 10px', borderRadius: '4px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#f8fafc', fontWeight: '500' }}>Relative Consensus Margin</span>
              <strong style={{ color: '#38bdf8' }}>{currentConsensus.toFixed(1)}%</strong>
            </div>
            <div style={{ width: '100%', height: '6px', background: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${currentConsensus}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)', transition: 'width 300ms ease' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <strong style={{ color: '#38bdf8', fontSize: '10px', letterSpacing: '0.05em' }}>REPUTATION DELTA & ESCALATION TRACE</strong>
          <div style={{ display: 'flex', flexDirection: 'column', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155', gap: '4px' }}>
            <span style={{ color: '#a5b4fc', fontSize: '9px', fontWeight: 'bold' }}>USER REPUTATION IMPACT PREDICTOR</span>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#f8fafc', fontWeight: '500' }}>If Published</span>
              <strong style={{ color: '#22c55e' }}>{currentTrust} {"->"} {trustIfPublished}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#f8fafc', fontWeight: '500' }}>If Rejected</span>
              <strong style={{ color: '#ef4444' }}>{currentTrust} {"->"} {trustIfRejected}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#1e293b', padding: '6px 10px', borderRadius: '4px', border: '1px solid #334155', color: '#fca5a5' }}>
            <span style={{ color: '#fecaca', fontWeight: '500' }}>Automated System Escalation</span>
            <strong>15% Rejection Margin</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
