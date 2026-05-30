import React from 'react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0));
}

export default function KPIWidget({ profile, compact = false }) {
  if (!profile) return null;

  const metrics = [
    { label: 'Bills Authored', value: profile.billsAuthored },
    { label: 'Projects Completed', value: profile.projectCompletions },
    { label: 'COA Findings', value: profile.coaAuditDiscrepancies, isAlert: profile.coaAuditDiscrepancies > 0 },
    { label: 'Budget Tracked', value: formatCurrency(profile.trackedBudgetAllocated) },
    { label: 'Efficiency', value: `${Number(profile.legislativeEfficiencyRatio || 0).toFixed(1)}%` },
  ];

  return (
    <section className={compact ? 'kpiGrid compact' : 'kpiGrid'} aria-label="Performance indicators">
      {metrics.map(({ label, value, isAlert }) => (
        <article
          className={`kpiCard ${isAlert ? 'kpi-card-alert' : ''}`}
          key={label}
          style={isAlert ? { borderLeft: '3px solid var(--ph-gold)', background: '#fef9e8' } : {}}
        >
          <span className="ty-label">{label}</span>
          <strong style={isAlert ? { color: '#92660a' } : {}}>{value ?? 'N/A'}</strong>
        </article>
      ))}
    </section>
  );
}
