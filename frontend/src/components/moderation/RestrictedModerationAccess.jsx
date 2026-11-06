import { AlertTriangleIcon } from '../icons/Lucide'

export default function RestrictedModerationAccess() {
  return (
    <section className="workspace">
      <div style={{
        textAlign: 'center',
        padding: '48px 32px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--danger-soft)',
          marginBottom: '16px',
        }}>
          <AlertTriangleIcon size={22} />
        </div>
        <h2 className="ty-section-title" style={{ color: 'var(--danger)', margin: '0 0 10px' }}>Access Restricted</h2>
        <p className="ty-body" style={{ color: 'var(--text-muted)', margin: '0 auto', maxWidth: '460px' }}>
          Contributor accounts do not have authorized clearance to view or moderate pending queue cards.
        </p>
        <p className="ty-meta" style={{ color: 'var(--text-subtle)', marginTop: '16px', fontStyle: 'italic' }}>
          Presentation Note: Open the floating user profile drawer to reset your Session Role Override to JUDICIAL_REVIEWER.
        </p>
      </div>
    </section>
  )
}
