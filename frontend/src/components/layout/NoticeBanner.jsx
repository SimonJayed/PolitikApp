import { AlertTriangleIcon } from '../icons/Lucide'

export default function NoticeBanner({ message, onDismiss }) {
  if (!message) return null

  return (
    <div style={{
      margin: '12px 0 20px',
      padding: '12px 20px',
      borderRadius: '12px',
      background: '#fef3c7',
      border: '1px solid #f59e0b',
      color: '#92400e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: '14px',
      fontWeight: '500',
    }}>
      <span><AlertTriangleIcon size={16} /> {message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#92400e',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
        aria-label="Dismiss notice"
      >
        {'\u00d7'}
      </button>
    </div>
  )
}
