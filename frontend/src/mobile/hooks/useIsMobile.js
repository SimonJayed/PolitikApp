import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

/**
 * Hook to detect if current viewport is mobile (<= 768px).
 * SSR-safe and reacts cleanly to resize and orientation changes.
 */
export function useIsMobile(query = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia ? window.matchMedia(query).matches : window.innerWidth <= 768
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQueryList = window.matchMedia(query)
    const updateMatch = (event) => {
      setIsMobile(event.matches)
    }

    // Set initial accurate value
    setIsMobile(mediaQueryList.matches)

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch)
      return () => mediaQueryList.removeEventListener('change', updateMatch)
    } else {
      // Fallback for older WebKit / Safari
      mediaQueryList.addListener(updateMatch)
      return () => mediaQueryList.removeListener(updateMatch)
    }
  }, [query])

  return isMobile
}

export default useIsMobile

