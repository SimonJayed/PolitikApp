const STAGES = ['SUBMITTED', 'UNDER REVIEW', 'PUBLISHED', 'DISMISSED']

export function getLifecycleStageIndex(status) {
  switch ((status || '').toUpperCase()) {
    case 'SUBMITTED_REQUEST':
    case 'CHALLENGE_OPEN':
    case 'SUBMITTED':
    case 'PENDING':
      return 0
    case 'UNDER_REVIEW':
    case 'JURY_REVIEW':
    case 'ESCALATED':
    case 'APPEALED_PENDING':
    case 'REVISION_REQUIRED':
      return 1
    case 'RESOLVED_UPHELD':
    case 'PUBLISHED':
      return 2
    case 'RESOLVED_DISMISSED':
    case 'REJECTED':
      return 3
    default:
      return 0
  }
}

export default function LifecycleStageStrip({ status, title = 'Curation Lifecycle Stage' }) {
  const activeStage = getLifecycleStageIndex(status)
  const normStatus = (status || '').toUpperCase()
  const isDismissed = normStatus === 'RESOLVED_DISMISSED' || normStatus === 'REJECTED'

  const stageStyles = {
    SUBMITTED: { bg: 'var(--info-soft, rgba(56, 189, 248, 0.12))', border: 'var(--info-border, rgba(56, 189, 248, 0.3))', text: 'var(--info, #0284c7)' },
    'UNDER REVIEW': { bg: 'var(--warning-soft, rgba(245, 158, 11, 0.12))', border: 'var(--warning-border, rgba(245, 158, 11, 0.3))', text: 'var(--warning, #d97706)' },
    PUBLISHED: { bg: 'var(--success-soft, rgba(16, 185, 129, 0.12))', border: 'var(--success-border, rgba(16, 185, 129, 0.3))', text: 'var(--success, #059669)' },
    DISMISSED: { bg: 'var(--danger-soft, rgba(239, 68, 68, 0.12))', border: 'var(--danger-border, rgba(239, 68, 68, 0.3))', text: 'var(--danger, #dc2626)' },
  }

  return (
    <div style={{ marginTop: '4px', paddingTop: '14px', borderTop: '1px dashed var(--line-soft, #e2e8f0)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span className="ty-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary, #64748b)' }}>{title}</span>
        <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: '10px', fontWeight: 600, color: 'var(--text-subtle, #94a3b8)' }}>
          {status || 'SUBMITTED_REQUEST'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px' }}>
        {STAGES.map((stage, index) => {
          const isCurrent = index === activeStage
          const isPast = index <= activeStage
          // If dismissed, stage 2 (published) is skipped
          const shouldHighlight = isDismissed ? (index === 0 || index === 1 || index === 3) && index <= activeStage : isPast
          const palette = stageStyles[stage] || stageStyles.SUBMITTED

          return (
            <span
              key={stage}
              style={{
                textAlign: 'center',
                padding: '6px 4px',
                borderRadius: '6px',
                fontFamily: 'var(--mono, monospace)',
                fontSize: '10px',
                fontWeight: isCurrent ? '700' : '500',
                letterSpacing: '0.03em',
                border: `1px solid ${shouldHighlight ? palette.border : 'var(--line-soft, #e2e8f0)'}`,
                background: shouldHighlight ? palette.bg : 'var(--bg-inset, #f8fafc)',
                color: shouldHighlight ? palette.text : 'var(--text-subtle, #94a3b8)',
                opacity: shouldHighlight ? 1 : 0.5,
                boxShadow: isCurrent ? '0 0 0 2px rgba(14, 165, 233, 0.2)' : 'none',
                transition: 'all 200ms ease',
              }}
            >
              {stage}
            </span>
          )
        })}
      </div>
    </div>
  )
}
