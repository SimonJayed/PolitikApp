import React, { useState, useEffect, useRef } from 'react';
import { ExternalLinkIcon, ScaleIcon, ArrowLeftIcon, ArrowRightIcon } from '../icons/Lucide';
import TrustScoreMeter from '../TrustScoreMeter';
import { clampTrustScore } from '../trustScore';
import { TimelineCardsSkeleton } from '../Skeletons';

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
  const trustScore = clampTrustScore(user?.trustScore);
  const canAppeal = Boolean(user?.userId) && user?.role !== 'GUEST' && trustScore >= 150;
  const [page, setPage] = useState(1);
  const [hoverInfo, setHoverInfo] = useState(null);
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
          {pagedEntries.map((entry) => (
            <article className="timelineItem" key={entry.timelineId || `${entry.categoryTag}-${entry.createdAt}`}>
              <div className="timelineItemTop">
                <strong>{entry.actionIdentifier}</strong>
                <span style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--line-soft)',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: '11px',
                  fontWeight: '500',
                  letterSpacing: '0.04em',
                  padding: '2px 8px',
                  color: 'var(--text-muted)'
                }}>
                  {entry.categoryTag}
                </span>
              </div>
              <p className="ty-body">{entry.summary}</p>
              <a
                href={entry.sourceUrl}
                rel="noreferrer"
                target="_blank"
                onMouseEnter={(e) => setHoverInfo({
                  title: 'Source Evidence Link',
                  description: 'Opens the cited source document in a separate tab so you can validate authenticity, context, and completeness.',
                  hint: 'Tip: verify domain and publication date before citing.',
                  x: e.clientX,
                  y: e.clientY
                })}
                onMouseMove={(e) => setHoverInfo((current) => current ? { ...current, x: e.clientX, y: e.clientY } : current)}
                onMouseLeave={() => setHoverInfo(null)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  View Source <ExternalLinkIcon size={14} />
                </span>
              </a>
              {onAppeal && (
                <div className="appealActionArea">
                  <button
                    className="appealRecordButton"
                    disabled={!canAppeal || !entry.submissionId}
                    onClick={() => onAppeal(entry)}
                    title={
                      !entry.submissionId
                        ? 'This legacy record is missing submission linkage.'
                        : !canAppeal
                        ? 'Appeals require an authenticated user with at least 150.00 trust points.'
                        : 'File a high-stakes post-publish appeal.'
                    }
                    type="button"
                  >
                    <ScaleIcon size={15} />
                    Appeal this Record
                  </button>
                  <div className="appealInfoTooltip" role="tooltip">
                    {entry.submissionId ? (
                      <TrustScoreMeter score={trustScore} variant="inline" />
                    ) : (
                      <p className="ty-meta" style={{ color: 'var(--danger)', margin: 0 }}>
                        Record cannot be appealed: missing submission linkage.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <CursorHint hoverInfo={hoverInfo} />
    </section>
  );
}
export { PaginationMini };
