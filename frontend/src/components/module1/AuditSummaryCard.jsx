import React from 'react';
import { AlertTriangleIcon } from '../icons/Lucide';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value || 0));
}

export default function AuditSummaryCard({ coaDiscrepancies = 0, flaggedAmount = 0 }) {
  const hasDiscrepancies = coaDiscrepancies > 0;

  return (
    <article
      className={`audit-summary-card card ${hasDiscrepancies ? 'has-findings' : 'clear'}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line-soft)',
        borderLeft: `4px solid ${hasDiscrepancies ? 'var(--ph-gold)' : 'var(--success)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="ty-card-title" style={{ margin: 0, fontSize: '15px', color: 'var(--text-primary)', fontWeight: '700' }}>
          Commission on Audit (COA) Summary
        </h3>
        {hasDiscrepancies && (
          <span style={{ color: 'var(--ph-gold)', display: 'inline-flex', alignItems: 'center' }}>
            <AlertTriangleIcon size={18} />
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Discrepancies Logged</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: hasDiscrepancies ? 'var(--ph-gold)' : 'var(--text-primary)' }}>
            {coaDiscrepancies}
          </strong>
        </div>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Flagged Amount</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: hasDiscrepancies ? 'var(--danger)' : 'var(--text-primary)' }}>
            {formatCurrency(flaggedAmount)}
          </strong>
        </div>
      </div>

      {hasDiscrepancies ? (
        <div
          style={{
            background: '#fef9e8',
            border: '1px solid #f0c040',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#92660a',
            lineHeight: '1.5',
            marginTop: '4px',
          }}
        >
          <strong>Warning:</strong> Commission on Audit has flagged {coaDiscrepancies} potential discrepancies. Prioritizing transparency review is highly recommended.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--success-soft)',
            border: '1px solid var(--success-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'var(--success)',
            lineHeight: '1.5',
            marginTop: '4px',
          }}
        >
          ✓ No active Commission on Audit flags detected for this jurisdiction term.
        </div>
      )}
    </article>
  );
}
