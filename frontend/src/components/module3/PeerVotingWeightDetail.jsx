import React from 'react';
import VoteWeightIndicator from './VoteWeightIndicator';
import AccuracyMetricCard from './AccuracyMetricCard';

function MetricCard({ label, tone = 'neutral', value }) {
  return (
    <article className={`matrixMetricCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function PeerVotingWeightDetail({
  tier,
  consensusVotes,
  dissentVotes,
  consensusRate,
  weight
}) {
  const displayWeight = weight !== undefined ? weight : tier.weight;
  return (
    <section className="matrixCardGrid">
      <MetricCard label="Audit Tier" value={tier.label} tone={tier.tone} />
      <VoteWeightIndicator weight={displayWeight} tierLabel={tier.label} tone={tier.tone} />
      <MetricCard label="Consensus-Aligned Ballots" value={consensusVotes} tone="success" />
      <MetricCard label="Dissenting Ballots" value={dissentVotes} tone="danger" />
      <AccuracyMetricCard consensusRate={consensusRate} />
    </section>
  );
}
