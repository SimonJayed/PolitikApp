const STAGES = ['SUBMITTED', 'JURY REVIEW', 'ADJUDICATION', 'FINALIZED', 'PUBLISHED']

export function getLifecycleStageIndex(status) {
  switch ((status || '').toUpperCase()) {
    case 'SUBMITTED':
    case 'PENDING':
      return 0
    case 'JURY_REVIEW':
      return 1
    case 'ESCALATED':
    case 'APPEALED_PENDING':
    case 'REVISION_REQUIRED':
      return 2
    case 'REJECTED':
      return 3
    case 'PUBLISHED':
      return 4
    default:
      return 0
  }
}

export default function LifecycleStageStrip({ status, title = 'Lifecycle Stage' }) {
  const activeStage = getLifecycleStageIndex(status)
  const isRejected = (status || '').toUpperCase() === 'REJECTED'

  return (
    <div style={{ marginTop: '4px', paddingTop: '16px', borderTop: '1px dashed var(--line-soft)' }}>
      <span className="ty-label" style={{ display: 'block', marginBottom: '10px' }}>{title}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
        {STAGES.map((stage, index) => {
          const isPast = index <= activeStage
          const isActive = index === activeStage
          const stageLabel = stage === 'FINALIZED' && isRejected ? 'REJECTED' : stage
          return (
            <span key={stage} style={{
              textAlign: 'center',
              padding: '6px 4px',
              borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--mono, monospace)',
              fontSize: '10px',
              fontWeight: '600',
              letterSpacing: '0.04em',
              border: `1px solid ${isPast ? (isRejected && index === 3 ? 'var(--danger-border)' : 'var(--ph-blue)') : 'var(--line-soft)'}`,
              background: isPast
                ? (isRejected && index === 3 ? 'var(--danger)' : 'var(--ph-blue)')
                : 'var(--bg-inset)',
              color: isPast ? '#ffffff' : 'var(--text-subtle)',
              opacity: isPast ? 1 : 0.6,
              boxShadow: isActive ? '0 0 0 2px rgba(10,29,66,0.15)' : 'none',
              transition: 'all 200ms ease',
            }}>
              {stageLabel}
            </span>
          )
        })}
      </div>
    </div>
  )
}
