import React from 'react';
import { AlertTriangleIcon } from '../icons/Lucide';
import { ModerationCardsSkeleton } from '../Skeletons';
import EscalationDetail from './EscalationDetail';
import AdminEscalationActions from './AdminEscalationActions';

export default function EscalationDashboard({
  escalatedQueue,
  escalatedLoading,
  getForm,
  updateForm,
  handleAdminOverride,
}) {
  return (
    <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '2px dashed var(--line-strong)' }}>
      <div className="mod-header mod-header--admin">
        <div className="mod-header-copy">
          <div className="mod-header-titleRow">
            <span className="mod-header-icon"><AlertTriangleIcon size={20} /></span>
            <div>
              <h2 className="ty-section-title">System Admin Arbitration Adjudication Queue</h2>
              <p className="ty-body">Exposes deadlocked or timed-out tickets with vote weight distributions for immediate admin overrides.</p>
            </div>
          </div>
        </div>
      </div>

      {escalatedLoading ? (
        <ModerationCardsSkeleton count={1} />
      ) : (
        <div className="queue-deck" style={{ marginTop: '20px' }}>
          {escalatedQueue.length === 0 && (
            <div className="review-card" style={{ background: '#ffffff', border: '1px dashed #dbe5ea', width: '100%' }}>
              <p className="emptyState">No escalated or deadlocked cards require admin overrides.</p>
            </div>
          )}

          {escalatedQueue.map((card) => {
            const form = getForm(card.queueId);

            return (
              <div className="review-card" key={card.queueId} style={{ borderLeft: '4px solid var(--ph-gold)', width: '100%', boxSizing: 'border-box' }}>
                <EscalationDetail card={card} />
                
                <AdminEscalationActions
                  queueId={card.queueId}
                  voteReason={form.voteReason}
                  onUpdateReason={(val) => updateForm(card.queueId, { voteReason: val })}
                  onOverride={handleAdminOverride}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
