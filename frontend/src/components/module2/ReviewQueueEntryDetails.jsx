import React, { useState } from 'react';
import { UserCircleIcon, ExternalLinkIcon } from '../icons/Lucide';
import LifecycleStageStrip from '../LifecycleStageStrip';

function parseActionDetails(card) {
  if (card?.actionDetails && typeof card.actionDetails === 'object') return card.actionDetails;
  if (!card?.actionDetailsJson) return {};
  try {
    return JSON.parse(card.actionDetailsJson);
  } catch {
    return {};
  }
}

function metricValue(details, key, fallback = 'Not provided') {
  const value = details?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

function formatCurrency(value) {
  if (value === 'Not provided' || isNaN(value)) return value;
  return new Intl.NumberFormat('en-PH', { currency: 'PHP', maximumFractionDigits: 0, style: 'currency' }).format(Number(value));
}

function formatDate(value) {
  if (!value || value === 'Not provided') return value;
  try {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return String(value);
  }
}

export default function ReviewQueueEntryDetails({ card }) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  if (!card) return null;

  const details = parseActionDetails(card);
  const actionId = card.actionIdentifier || '';
  const isUnverifiedSource = details.isApprovedDomain === false;

  return (
    <div className="review-queue-entry-details">
      <div className="review-cardTop">
        <div className="review-cardIdentity">
          <span className="review-cardIcon"><UserCircleIcon size={18} /></span>
          <div>
            <p className="review-cardLabel">Submitted By</p>
            <p className="review-cardValue">{card.contributorName || 'Not provided'}</p>
          </div>
        </div>
        <div className="review-cardMetaPill">Queue #{String(card.queueId).slice(0, 8)}</div>
      </div>

      <div className="review-cardFacts">
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Action</span>
          <strong>{String(card.actionIdentifier || card.categoryTag || 'Not provided').replaceAll('_', ' ')}</strong>
        </div>
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Politician</span>
          <strong>{card.politicianName || card.politicianId || 'Not provided'}</strong>
        </div>
        <div className="review-cardFact review-cardFactLink">
          <span className="review-cardFactLabel">Source Link</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <a href={card.sourceUrl} rel="noreferrer" target="_blank">
              <ExternalLinkIcon size={14} />
              <span>{card.sourceUrl}</span>
            </a>
            {isUnverifiedSource && (
              <span className="unverified-domain-badge" role="alert">
                ⚠ UNVERIFIED SOURCE DOMAIN
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="review-cardFacts">
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Category</span>
          <strong>{card.categoryTag || 'Not provided'}</strong>
        </div>
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Jurisdiction</span>
          <strong>{card.jurisdiction || 'Not provided'}</strong>
        </div>
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Submitted Date</span>
          <strong>{card.createdAt ? new Date(card.createdAt).toLocaleString('en-PH') : 'Not provided'}</strong>
        </div>
      </div>

      {/* Dynamic Action Metrics Row */}
      {actionId && (
        <div className="review-cardFacts" style={{ borderTop: '1px dashed rgba(148, 163, 184, 0.15)', paddingTop: '16px', marginTop: '8px' }}>
          {actionId === 'COA_FINDING' && (
            <div className="review-cardFact">
              <span className="review-cardFactLabel">Audit Flagged Amount (PHP)</span>
              <strong>{formatCurrency(metricValue(details, 'flaggedAmount'))}</strong>
            </div>
          )}
          {actionId === 'BUDGET_ALLOCATION' && (
            <div className="review-cardFact">
              <span className="review-cardFactLabel">Budget Allocation Amount (PHP)</span>
              <strong>{formatCurrency(metricValue(details, 'allocationAmount'))}</strong>
            </div>
          )}
          {actionId === 'PROJECT_COMPLETION' && (
            <div className="review-cardFact">
              <span className="review-cardFactLabel">Project Completion Percentage (%)</span>
              <strong>{metricValue(details, 'completionPercentage') !== 'Not provided' ? `${metricValue(details, 'completionPercentage')}%` : 'Not provided'}</strong>
            </div>
          )}
          {actionId === 'SPONSORED_LEGISLATION' && (
            <>
              <div className="review-cardFact">
                <span className="review-cardFactLabel">Legislation Title</span>
                <strong>{metricValue(details, 'legislationTitle')}</strong>
              </div>
              <div className="review-cardFact">
                <span className="review-cardFactLabel">Date Filed</span>
                <strong>{formatDate(metricValue(details, 'dateFiled'))}</strong>
              </div>
              <div className="review-cardFact">
                <span className="review-cardFactLabel">Legislative Status</span>
                <strong>{metricValue(details, 'legislativeStatus')}</strong>
              </div>
            </>
          )}
        </div>
      )}

      <div className="summary-box">"{card.impactSummary || 'Not provided'}"</div>

      <LifecycleStageStrip status={card.queueStatus} title="Current Lifecycle Stage" />

    </div>
  );
}
