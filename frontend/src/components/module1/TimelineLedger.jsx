import React, { useState, useEffect, useRef } from 'react';
import { ExternalLinkIcon, ScaleIcon, ArrowLeftIcon, ArrowRightIcon } from '../icons/Lucide';
import { TimelineCardsSkeleton } from '../Skeletons';
import { formatActionIdentifier } from './positionConfig';
import ChallengeRecordModal from '../module2/ChallengeRecordModal';

function PaginationMini({ page, totalPages, onChange }) {
  const disabledPrev = page <= 1;
  const disabledNext = page >= totalPages;
  return (
    <nav className="paginationMini" aria-label="Pagination">
      <button
        type="button"
        disabled={disabledPrev}
        onClick={() => onChange((p) => Math.max(1, p - 1))}
        className="paginationButton"
        aria-label="Previous page"
      >
        <ArrowLeftIcon size={17} strokeWidth={2.4} />
      </button>
      <span className="paginationText" aria-live="polite">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={disabledNext}
        onClick={() => onChange((p) => Math.min(totalPages, p + 1))}
        className="paginationButton"
        aria-label="Next page"
      >
        <ArrowRightIcon size={17} strokeWidth={2.4} />
      </button>
    </nav>
  );
}

function CursorHint({ hoverInfo }) {
  const hintRef = useRef(null);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });

  useEffect(() => {
    if (!hoverInfo?.x || !hoverInfo?.y || !hintRef.current) return;
    const tooltipRect = hintRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const offsetX = 6;
    const offsetY = 8;
    const margin = 6;

    let left = hoverInfo.x + offsetX;
    let top = hoverInfo.y + offsetY;

    if (left + tooltipRect.width > viewportWidth - margin) {
      left = hoverInfo.x - tooltipRect.width - offsetX;
    }
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = hoverInfo.y - tooltipRect.height - offsetY;
    }

    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    setPosition({ left, top });
  }, [hoverInfo]);

  if (!hoverInfo?.x || !hoverInfo?.y) return null;
  return (
    <div ref={hintRef} aria-hidden="true" className="cursorHint" style={{ left: `${position.left}px`, top: `${position.top}px` }}>
      <strong>{hoverInfo.title}</strong>
      <span>{hoverInfo.description}</span>
      {hoverInfo.hint ? <small>{hoverInfo.hint}</small> : null}
    </div>
  );
}

export default function TimelineLedger({
  className = '',
  entries = [],
  compact = false,
  isLoading = false,
  onAppeal,
  title = 'Published Timeline Ledger',
  user,
}) {
  const [page, setPage] = useState(1);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [challengeModalRecord, setChallengeModalRecord] = useState(null);
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [entries.length]);

  return (
    <section className={[compact ? 'timeline compact' : 'timeline', className].filter(Boolean).join(' ')}>
      <div className="timelineHeader">
        <h2 className="ty-section-title">{title}</h2>
        {!isLoading && entries.length > pageSize && (
          <PaginationMini page={safePage} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
      {isLoading && <TimelineCardsSkeleton count={6} />}
      {!isLoading && entries.length === 0 && <p className="emptyState">No published records returned.</p>}
      {!isLoading && (
        <div className="timelineGrid">
          {pagedEntries.map((entry) => {
            const sourceUrl = entry.primarySourceUrl || entry.sourceUrl;
            return (
              <article className="timelineItem" key={entry.timelineId || `${entry.categoryTag}-${entry.createdAt}`}>
                <div className="timelineItemTop">
                  <strong>{formatActionIdentifier(entry.actionIdentifier)}</strong>
                  <span style={{
                    background: 'var(--bg-inset, #f8fafc)',
                    border: '1px solid var(--line-soft, #e2e8f0)',
                    borderRadius: 'var(--radius-full, 9999px)',
                    fontFamily: 'var(--mono, monospace)',
                    fontSize: '11px',
                    fontWeight: '500',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    color: 'var(--text-muted, #64748b)'
                  }}>
                    {entry.categoryTag}
                  </span>
                </div>
                <p className="ty-body">{entry.summary}</p>

                {entry.verificationNotes && (
                  <div style={{
                    fontSize: '11px',
                    color: '#047857',
                    background: '#ecfdf5',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    fontFamily: 'var(--mono, monospace)'
                  }}>
                    ✓ Curator Verified: {entry.verificationNotes}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--line-soft, #f1f5f9)',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  {sourceUrl ? (
                    <a
                      href={sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: 'var(--info, #0284c7)',
                        textDecoration: 'none',
                        fontWeight: '500'
                      }}
                      onMouseEnter={(e) => setHoverInfo({
                        title: 'Primary Source Citation',
                        description: 'Direct link to primary source document (COA report, legislative record, or official gazette).',
                        hint: 'Click to verify authenticity.',
                        x: e.clientX,
                        y: e.clientY
                      })}
                      onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
                      onMouseLeave={() => setHoverInfo(null)}
                    >
                      Primary Source <ExternalLinkIcon size={13} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Citation pending</span>
                  )}

                  <button
                    type="button"
                    onClick={() => setChallengeModalRecord(entry)}
                    title="Challenge this record with counter-evidence or audit discrepancies"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fff5f5',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 150ms ease'
                    }}
                  >
                    ⚠️ Challenge Record
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <CursorHint hoverInfo={hoverInfo} />

      <ChallengeRecordModal
        isOpen={Boolean(challengeModalRecord)}
        onClose={() => setChallengeModalRecord(null)}
        targetRecord={challengeModalRecord}
        onChallengeSubmitted={() => {
          setChallengeModalRecord(null);
        }}
      />
    </section>
  );
}
export { PaginationMini };
