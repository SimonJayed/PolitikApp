import { useEffect, useRef } from 'react'

function BaseModal({
  children,
  isDismissDisabled = false,
  isOpen,
  onClose,
  title,
}) {
  const modalRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    openerRef.current = document.activeElement

    function handleEscape(event) {
      if (event.key === 'Escape' && !isDismissDisabled) onClose?.()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)
    setTimeout(() => modalRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleEscape)
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus()
      }
    }
  }, [isDismissDisabled, isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      aria-hidden="true"
      className="comparisonModalBackdrop"
      onClick={() => {
        if (!isDismissDisabled) onClose?.()
      }}
    >
      <section
        aria-label={title || 'Modal'}
        aria-modal="true"
        className="comparisonModal"
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  )
}

export default BaseModal
