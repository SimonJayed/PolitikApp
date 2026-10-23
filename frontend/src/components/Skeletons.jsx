export function SkeletonLine({ width = '100%', height = 12, className = '' }) {
  return <span className={`appSkeleton ${className}`.trim()} style={{ width, height }} aria-hidden="true" />
}

export function RankingRowsSkeleton({ rows = 6 }) {
  return (
    <div className="rankingPanelTable" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="rankingRow" key={`ranking-s-${index}`}>
          <SkeletonLine width={34} height={12} />
          <span className="rankingIdentity">
            <SkeletonLine width="75%" height={14} />
            <SkeletonLine width="55%" height={11} />
          </span>
          <SkeletonLine width={62} height={12} />
          <SkeletonLine width={96} height={12} />
          <SkeletonLine width={84} height={20} className="rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function TimelineCardsSkeleton({ count = 6 }) {
  return (
    <div className="timelineGrid" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="timelineItem" key={`timeline-s-${index}`}>
          <div className="timelineItemTop">
            <SkeletonLine width={120} height={14} />
            <SkeletonLine width={74} height={20} className="rounded-full" />
          </div>
          <SkeletonLine width="96%" height={12} />
          <SkeletonLine width="88%" height={12} />
          <SkeletonLine width="45%" height={13} />
        </article>
      ))}
    </div>
  )
}

export function ModerationCardsSkeleton({ count = 2 }) {
  return (
    <div className="queue-deck" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <article className="review-card" key={`mod-s-${index}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SkeletonLine width={180} height={22} />
            <SkeletonLine width={90} height={20} className="rounded-full" />
          </div>
          <div className="review-cardFacts">
            <SkeletonLine width="100%" height={60} />
            <SkeletonLine width="100%" height={60} />
            <SkeletonLine width="100%" height={60} />
          </div>
          <SkeletonLine width="100%" height={70} />
          <div className="vote-options">
            <SkeletonLine width="100%" height={44} />
            <SkeletonLine width="100%" height={44} />
            <SkeletonLine width="100%" height={44} />
          </div>
          <SkeletonLine width="100%" height={44} />
          <SkeletonLine width="100%" height={46} />
        </article>
      ))}
    </div>
  )
}
