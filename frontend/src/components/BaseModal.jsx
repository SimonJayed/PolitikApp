import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

function BaseModal({
  children,
  isDismissDisabled = false,
  isOpen,
  modalClassName = '',
  onClose,
  title,
  wide = false,
}) {
  const modalRef = useRef(null)
  const openerRef = useRef(null)
  const closeRef = useRef(onClose)
  const dismissDisabledRef = useRef(isDismissDisabled)

  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => { dismissDisabledRef.current = isDismissDisabled }, [isDismissDisabled])

  useEffect(() => {
    if (!isOpen) return undefined
    openerRef.current = document.activeElement

    function handleKey(event) {
      if (event.key === 'Escape' && !dismissDisabledRef.current) closeRef.current?.()
      if (event.key !== 'Tab' || !modalRef.current) return
      const controls = [...modalRef.current.querySelectorAll(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
      )].filter(node => node.getClientRects().length > 0)
      const first = controls[0]
      const last = controls.at(-1)
      if (!first || (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current))
          || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        if (!first) modalRef.current.focus()
        else if (event.shiftKey) last.focus()
        else first.focus()
      }
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    const focusTimer = setTimeout(() => modalRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKey)
      clearTimeout(focusTimer)
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus({ preventScroll: true })
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const dialog = (
    <div
      className="comparisonModalBackdrop sharedModalBackdrop"
      onClick={() => {
        if (!isDismissDisabled) onClose?.()
      }}
    >
      <section
        aria-label={title || 'Modal'}
        aria-modal="true"
        data-wide={wide || undefined}
        className={`comparisonModal sharedModal ${modalClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="sharedModalHeader">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} disabled={isDismissDisabled}>Close</button>
        </header>
        <div className="sharedModalBody">{children}</div>
      </section>
    </div>
  )
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body)
}

export default BaseModal
