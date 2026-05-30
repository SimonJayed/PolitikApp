import React from 'react';
import {
  GavelIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '../icons/Lucide';
import { ModerationCardsSkeleton } from '../Skeletons';
import ReviewQueueEntryDetails from './ReviewQueueEntryDetails';
import PeerVotingPanel from './PeerVotingPanel';
import ConsensusStatusPanel from './ConsensusStatusPanel';
import EscalationDashboard from './EscalationDashboard';
import ModerationAlert from './ModerationAlert';

export default function ModerationQueueDashboard({
  queueLoading,
  queueDeck,
  isDevModeActive,
  handleSandboxShiftStage,
  openDrawerByCard,
  setOpenDrawerByCard,
  openDetailsByCard,
  setOpenDetailsByCard,
  manipulatedUser,
  user,
  voteWeight,
  isReadOnlyMode,
  getForm,
  updateForm,
  handleVoteSubmit,
  visibleQueue,
  queuePageSize,
  safeQueuePage,
  totalQueuePages,
  setQueuePage,
  isArchiveOpen,
  setIsArchiveOpen,
  ballotArchive,
  traceLogs,
  showTraceMonitor,
  setShowTraceMonitor,
  isAdminMode,
  escalatedQueue,
  escalatedLoading,
  handleAdminOverride,
}) {
  return (
    <div className="moderation-container">
      <div className="mod-header">
        <div className="mod-header-copy">
          <div className="mod-header-titleRow">
            <span className="mod-header-icon"><GavelIcon size={20} /></span>
            <div>
              <h2 className="ty-section-title">Asynchronous Judicial Moderation Engine</h2>
              <p>Pending Queue cards require community jury adjudication before publication.</p>
            </div>
          </div>
          <div className="mod-header-stats">
            <span className="mod-statChip"><ShieldCheckIcon size={16} /> Community Review</span>
            <span className="mod-statChip"><AlertTriangleIcon size={16} /> Escalation Ready</span>
          </div>
        </div>
      </div>

      {queueLoading ? (
        <ModerationCardsSkeleton count={2} />
      ) : (
        <div className="queue-deck">
          {queueDeck.length === 0 && (
            <div className="review-card">
              <p className="emptyState">No pending moderation cards in queue.</p>
            </div>
          )}
          {queueDeck.map((card) => {
            const form = getForm(card.queueId);
            const isDrawerOpen = openDrawerByCard[card.queueId] || false;

            return (
              <div className="review-card" key={card.queueId}>
                {isDevModeActive && (
                  <div className="sandbox-override-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)', padding: '8px 12px', borderBottom: '1px solid #334155', borderRadius: '6px 6px 0 0', margin: '-16px -16px 16px -16px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#38bdf8' }}>🛠️ SANDBOX PROCESS OVERRIDE</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => handleSandboxShiftStage(card.queueId, 'prev')} style={{ background: '#334155', border: '1px solid #475569', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        ⬅️ Previous Stage
                      </button>
                      <button type="button" onClick={() => handleSandboxShiftStage(card.queueId, 'next')} style={{ background: '#0284c7', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                        Next Stage ➡️
                      </button>
                    </div>
                  </div>
                )}

                <ReviewQueueEntryDetails card={card} />

                <PeerVotingPanel
                  card={card}
                  form={form}
                  updateForm={(updates) => updateForm(card.queueId, updates)}
                  handleVoteSubmit={() => handleVoteSubmit(card)}
                  isReadOnlyMode={isReadOnlyMode}
                  isDevModeActive={isDevModeActive}
                  isDrawerOpen={isDrawerOpen}
                  toggleAnalytics={() => setOpenDrawerByCard(prev => ({ ...prev, [card.queueId]: !isDrawerOpen }))}
                />

                {isDevModeActive && isDrawerOpen && (
                  <ConsensusStatusPanel
                    card={card}
                    isDevModeActive={isDevModeActive}
                    voteWeight={voteWeight}
                    manipulatedUser={manipulatedUser}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {visibleQueue.length > queuePageSize && (
        <div className="moderation-paginationRow">
          <nav className="paginationMini" aria-label="Moderation queue pagination">
            <button
              type="button"
              disabled={safeQueuePage <= 1}
              onClick={() => setQueuePage((current) => Math.max(1, current - 1))}
              className="paginationButton"
              aria-label="Previous queue page"
            >
              <ArrowLeftIcon size={17} strokeWidth={2.4} />
            </button>
            <span className="paginationText" aria-live="polite">
              {safeQueuePage} / {totalQueuePages}
            </span>
            <button
              type="button"
              disabled={safeQueuePage >= totalQueuePages}
              onClick={() => setQueuePage((current) => Math.min(totalQueuePages, current + 1))}
              className="paginationButton"
              aria-label="Next queue page"
            >
              <ArrowRightIcon size={17} strokeWidth={2.4} />
            </button>
          </nav>
        </div>
      )}

      <section className={isArchiveOpen ? 'mod-archive is-open' : 'mod-archive'}>
        <button
          type="button"
          className="mod-archiveToggle"
          onClick={() => setIsArchiveOpen((current) => !current)}
          aria-expanded={isArchiveOpen}
          aria-controls="moderation-archive-panel"
        >
          <span className="mod-archiveToggleTitle">Ballot Archive</span>
          <span className="mod-archiveToggleMeta">{ballotArchive.length} records</span>
          <span className={isArchiveOpen ? 'mod-archiveChevron is-open' : 'mod-archiveChevron'}><ArrowRightIcon size={16} /></span>
        </button>
        <div id="moderation-archive-panel" className={isArchiveOpen ? 'mod-archivePanel is-open' : 'mod-archivePanel'}>
          {ballotArchive.length === 0 ? (
            <p className="emptyState">No moderation history yet.</p>
          ) : (
            <>
              <div className="mod-archiveTableWrap">
                <table className="mod-archiveTable">
                  <thead>
                    <tr>
                      <th>Ballot</th>
                      <th>Your Vote</th>
                      <th>Status</th>
                      <th>Date Voted</th>
                      <th>Reviewer</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ballotArchive.map((entry) => (
                      <tr key={entry.queueId}>
                        <td>{entry.title}</td>
                        <td>{entry.userVote}</td>
                        <td>{entry.status}</td>
                        <td>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.votedAt))}</td>
                        <td>{entry.reviewer}</td>
                        <td>
                          {entry.sourceUrl ? (
                            <a className="mod-archiveAction" href={entry.sourceUrl} rel="noreferrer" target="_blank">View</a>
                          ) : (
                            <span className="mod-archiveAction is-disabled">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mod-archiveCards">
                {ballotArchive.map((entry) => (
                  <article className="mod-archiveCard" key={`card-${entry.queueId}`}>
                    <h4>{entry.title}</h4>
                    <p><strong>Vote:</strong> {entry.userVote}</p>
                    <p><strong>Status:</strong> {entry.status}</p>
                    <p><strong>Date:</strong> {new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.votedAt))}</p>
                    <p><strong>Reviewer:</strong> {entry.reviewer}</p>
                    {entry.sourceUrl ? <a className="mod-archiveAction" href={entry.sourceUrl} rel="noreferrer" target="_blank">View Details</a> : null}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {traceLogs.length > 0 && (
        <div className="moderation-toggleRow">
          <label className="toggle-switch" aria-hidden="false">
            <span className="toggle-label">Show Moderation Trace Monitor</span>
            <input
              type="checkbox"
              checked={showTraceMonitor}
              onChange={(e) => setShowTraceMonitor(e.target.checked)}
              aria-label="Show Moderation Trace Monitor"
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
          </label>
        </div>
      )}

      {showTraceMonitor && traceLogs.length > 0 && (
        <div className="terminal-audit-console">
          <div className="terminal-titlebar">Moderation Trace Monitor</div>
          <div className="terminal-screen">
            {traceLogs.slice(0, 8).map((log, index) => (
              <p className="terminal-line" key={`${log}-${index}`}>{log}</p>
            ))}
          </div>
        </div>
      )}

      {isAdminMode && (
        <EscalationDashboard
          escalatedQueue={escalatedQueue}
          escalatedLoading={escalatedLoading}
          getForm={getForm}
          updateForm={updateForm}
          handleAdminOverride={handleAdminOverride}
        />
      )}
    </div>
  );
}
