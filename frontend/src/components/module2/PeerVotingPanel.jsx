import React from 'react';
import { ShieldCheckIcon, ThumbUpIcon, ThumbDownIcon, FlagIcon } from '../icons/Lucide';

export default function PeerVotingPanel({
  card,
  form,
  updateForm,
  handleVoteSubmit,
  isReadOnlyMode,
  isDevModeActive,
  isDrawerOpen,
  toggleAnalytics,
}) {
  if (!card) return null;

  return (
    <div className="ballot-console">
      <div className="ballot-consoleHeader">
        <span className="ballot-consoleIcon"><ShieldCheckIcon size={18} /></span>
        <h4 className="ty-card-title" style={{ margin: 0 }}>Cast Evaluation Ballot</h4>
      </div>

      {isReadOnlyMode && (
        <div className="status-toast" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', padding: '10px', borderRadius: '6px', fontSize: '13px', margin: '8px 0' }}>
          Access Denied: Contributor accounts are restricted to Read-Only mode.
        </div>
      )}

      <div className="vote-options">
        <label className={form.voteSelection === 'AGREE' ? 'vote-option vote-option-agree is-selected' : 'vote-option vote-option-agree'}>
          <input
            checked={form.voteSelection === 'AGREE'}
            disabled={isReadOnlyMode}
            name={`vote-${card.queueId}`}
            onChange={(e) => updateForm({ voteSelection: e.target.value })}
            type="radio"
            value="AGREE"
          />
          <span className="vote-optionIcon"><ThumbUpIcon size={16} /></span>
          <span>Agree</span>
        </label>

        <label className={form.voteSelection === 'DISAGREE' ? 'vote-option vote-option-disagree is-selected' : 'vote-option vote-option-disagree'}>
          <input
            checked={form.voteSelection === 'DISAGREE'}
            disabled={isReadOnlyMode}
            name={`vote-${card.queueId}`}
            onChange={(e) => updateForm({ voteSelection: e.target.value })}
            type="radio"
            value="DISAGREE"
          />
          <span className="vote-optionIcon"><ThumbDownIcon size={16} /></span>
          <span>Disagree</span>
        </label>

        <label className={form.voteSelection === 'FLAG' ? 'vote-option vote-option-flag is-selected' : 'vote-option vote-option-flag'}>
          <input
            checked={form.voteSelection === 'FLAG'}
            disabled={isReadOnlyMode}
            name={`vote-${card.queueId}`}
            onChange={(e) => updateForm({ voteSelection: e.target.value })}
            type="radio"
            value="FLAG"
          />
          <span className="vote-optionIcon"><FlagIcon size={16} /></span>
          <span>Flag for Revision</span>
        </label>
      </div>

      <input
        className="justification-input"
        disabled={isReadOnlyMode}
        onChange={(e) => updateForm({ voteReason: e.target.value })}
        placeholder="Structural validation justification text lines..."
        type="text"
        value={form.voteReason || ''}
      />

      <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
        <button
          className="btn-submit-ballot"
          disabled={isReadOnlyMode}
          onClick={handleVoteSubmit}
          type="button"
          style={{ flex: 1, margin: 0 }}
        >
          Submit Live Ballot
        </button>
        {isDevModeActive && (
          <button 
            type="button" 
            onClick={toggleAnalytics}
            style={{
              background: isDrawerOpen ? '#1e293b' : '#334155',
              border: '1px solid #475569',
              color: '#38bdf8',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {isDrawerOpen ? '📊 Hide Analytics' : '📊 Show Analytics'}
          </button>
        )}
      </div>
    </div>
  );
}
