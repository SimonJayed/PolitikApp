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

export default function ReviewQueueEntryDetails({ card }) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  if (!card) return null;

  const details = parseActionDetails(card);

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
          <span className="review-cardFactLabel">Contribution Name</span>
          <strong>{card.actionIdentifier || card.categoryTag || 'Not provided'}</strong>
        </div>
        <div className="review-cardFact">
          <span className="review-cardFactLabel">Politician</span>
          <strong>{card.politicianName || card.politicianId || 'Not provided'}</strong>
        </div>
        <div className="review-cardFact review-cardFactLink">
          <span className="review-cardFactLabel">Source Link</span>
          <a href={card.sourceUrl} rel="noreferrer" target="_blank">
            <ExternalLinkIcon size={14} />
            <span>{card.sourceUrl}</span>
          </a>
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

      <div className="summary-box">"{card.impactSummary || 'Not provided'}"</div>

      <LifecycleStageStrip status={card.queueStatus} title="Current Lifecycle Stage" />

      <div className="detailsBlock detailsBlock--moderation">
        <h5 className="ty-label" style={{ margin: 0 }}>Submitted Metrics</h5>
        <div className="review-cardFacts">
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Bills Authored</span>
            <strong>{metricValue(details, 'billsAuthored')}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Projects Completed</span>
            <strong>{metricValue(details, 'projectsCompleted')}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">COA Findings</span>
            <strong>{metricValue(details, 'coaFindings')}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Efficiency</span>
            <strong>{metricValue(details, 'efficiency')}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Term Start</span>
            <strong>{card.termStart || 'Not provided'}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Term End</span>
            <strong>{card.termEnd || 'Not provided'}</strong>
          </div>
          <div className="review-cardFact">
            <span className="review-cardFactLabel">Status</span>
            <strong>{card.politicianStatus || 'Not provided'}</strong>
          </div>
        </div>
        <button
          type="button"
          className="paginationButton"
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          style={{ marginTop: '10px', width: 'auto', minWidth: '140px', borderRadius: '12px', padding: '0 12px' }}
        >
          {isDetailsOpen ? 'Hide full details' : 'View full details'}
        </button>
        {isDetailsOpen && (
          <div className="summary-box" style={{ marginTop: '10px' }}>
            <p style={{ margin: 0 }}><strong>Contributor Notes:</strong> {card.impactSummary || 'Not provided'}</p>
            <p style={{ margin: '8px 0 0' }}><strong>Action Details:</strong> {Object.keys(details).length ? JSON.stringify(details) : 'Not provided'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
