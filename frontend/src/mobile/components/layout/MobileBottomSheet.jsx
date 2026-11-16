import { useEffect, useRef } from 'react'
import { CircleXIcon } from '../../../components/icons/Lucide'

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
}) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    // Lock body scroll while sheet is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div
        className={`mobileSheetOverlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <section
        ref={sheetRef}
        className={`mobileBottomSheet ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
      >
        <div className="mobileSheetHandle" aria-hidden="true" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          {title && (
            <h2 style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: 700,
              fontFamily: 'var(--display, "Poppins", sans-serif)',
              color: 'var(--text-primary, #1e2d3d)'
            }}>
              {title}
            </h2>
          )}
          <button
            type="button"
            className="mobileTouchTarget"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ marginLeft: 'auto', color: 'var(--text-muted, #64748b)' }}
          >
            <CircleXIcon size={24} />
          </button>
        </div>

        <div className="mobileSheetContent">
          {children}
        </div>
      </section>
    </>
  )
}

export default MobileBottomSheet

