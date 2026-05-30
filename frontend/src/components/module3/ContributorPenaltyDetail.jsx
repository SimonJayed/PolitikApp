import React from 'react';
import RejectionMetricCard from './RejectionMetricCard';

function MetricCard({ label, tone = 'neutral', value }) {
  return (
    <article className={`matrixMetricCard ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function ContributorPenaltyDetail({
  submissions,
  approved,
  rejected,
  rate,
  rejectionLocked
}) {
  return (
    <section className="matrixCardGrid">
      <MetricCard label="Active Submissions" value={submissions} />
      <MetricCard label="Approved Cards" value={approved} tone="success" />
      <MetricCard label="Rejected Cards" value={rejected} tone="danger" />
      <RejectionMetricCard rate={rate} isLocked={rejectionLocked} />
    </section>
  );
}
