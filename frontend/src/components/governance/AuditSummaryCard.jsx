import React from 'react';
import { FileTextIcon, CircleCheckIcon } from '../icons/Lucide';

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
        borderLeft: `4px solid ${hasDiscrepancies ? 'var(--audit-accent)' : 'var(--success)'}`,
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
          <span style={{ color: 'var(--audit-accent)', display: 'inline-flex', alignItems: 'center' }}>
            <FileTextIcon size={18} />
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Discrepancies Logged</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: hasDiscrepancies ? 'var(--audit-accent)' : 'var(--text-primary)' }}>
            {coaDiscrepancies}
          </strong>
        </div>
        <div>
          <span className="ty-label" style={{ display: 'block', color: 'var(--text-muted)' }}>Flagged Amount</span>
          <strong style={{ fontSize: '20px', fontWeight: '800', color: hasDiscrepancies ? 'var(--text-primary)' : 'var(--text-primary)' }}>
            {formatCurrency(flaggedAmount)}
          </strong>
        </div>
      </div>

      {hasDiscrepancies ? (
        <div
          style={{
            background: 'var(--audit-bg)',
            border: '1px solid var(--audit-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            lineHeight: '1.5',
            marginTop: '4px',
          }}
        >
          The records contain {coaDiscrepancies} audit observations. Read the cited reports for the audit periods and agency responses.
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
          <><CircleCheckIcon size={14} /> No active Commission on Audit flags detected for this jurisdiction term.</>
        </div>
      )}
    </article>
  );
}
