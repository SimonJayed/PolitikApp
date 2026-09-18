import React from 'react';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0));
}

export default function BudgetAllocationCard({ budgetAllocated = 0, projectCompletions = 0, efficiencyRatio = 0 }) {
  const formattedBudget = formatCurrency(budgetAllocated);

  return (
    <article
      className="budget-allocation-card card"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line-soft)',
        borderLeft: '4px solid var(--ph-blue)',
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
    >
      <h3 className="ty-card-title" style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: '700' }}>
        Tracked Budget & Project Allocations
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Tracked Budget</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: 'var(--ph-blue)' }}>{formattedBudget}</strong>
        </div>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Projects Completed</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>{projectCompletions}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Project Implementation Efficiency</span>
          <strong style={{ color: 'var(--text-primary)' }}>{Number(efficiencyRatio).toFixed(1)}%</strong>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'var(--bg-inset)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, efficiencyRatio))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--ph-blue) 0%, #0284c7 100%)',
              borderRadius: '4px',
              transition: 'width 300ms ease',
            }}
          />
        </div>
      </div>
    </article>
  );
}
