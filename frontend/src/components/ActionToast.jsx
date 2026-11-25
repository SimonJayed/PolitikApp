import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangleIcon, CircleCheckIcon, XIcon } from './icons/Lucide'
import './ActionToast.css'

export default function ActionToast({ message, onDismiss }) {
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!message || message.error || focused) return
    const timeout = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timeout)
  }, [message, onDismiss, focused])

  const Icon = message?.error ? AlertTriangleIcon : CircleCheckIcon
  return createPortal(
    <div className="actionToastRegion">
      <span className="sr-only" role="status" aria-atomic="true">{message?.text}</span>
      {message && (
        <div className="actionToast" data-error={message.error || undefined}>
          <Icon size={20} aria-hidden="true" />
          <p aria-hidden="true">{message.text}</p>
          <button type="button" className="actionToastClose" aria-label="Dismiss notification"
            onClick={() => { setFocused(false); onDismiss() }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
