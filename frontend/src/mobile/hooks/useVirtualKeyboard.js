import { useEffect, useState } from 'react'

/**
 * Hook to detect if a software/virtual keyboard is visible on a mobile device.
 * Uses window.visualViewport height reduction combined with focus tracking.
 */
export function useVirtualKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFocusChange = () => {
      const activeEl = document.activeElement
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable ||
        activeEl.getAttribute('role') === 'textbox'
      )
      
      // If visualViewport exists, verify that viewport height has decreased
      if (window.visualViewport) {
        const heightReduction = window.innerHeight - window.visualViewport.height
        if (heightReduction > 150) {
          setIsKeyboardOpen(true)
          return
        }
      }

      if (isInput) {
        setIsKeyboardOpen(true)
      } else {
        setIsKeyboardOpen(false)
      }
    }

    const handleViewportResize = () => {
      if (!window.visualViewport) return
      const heightReduction = window.innerHeight - window.visualViewport.height
      setIsKeyboardOpen(heightReduction > 150)
    }

    const handleFocusOut = () => {
      // Small timeout to allow next activeElement to register if tabbing between fields
      setTimeout(() => {
        const activeEl = document.activeElement
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        )
        if (!isInput) {
          setIsKeyboardOpen(false)
        }
      }, 100)
    }

    window.addEventListener('focusin', handleFocusChange)
    window.addEventListener('focusout', handleFocusOut)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize)
    }

    return () => {
      window.removeEventListener('focusin', handleFocusChange)
      window.removeEventListener('focusout', handleFocusOut)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize)
      }
    }
  }, [])

  return isKeyboardOpen
}

export default useVirtualKeyboard

