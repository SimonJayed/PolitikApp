import { LoadingSkeleton } from "../components/Skeletons"
import { lazy, Suspense } from 'react'
import { useIsMobile } from '../mobile/hooks/useIsMobile'

const DesktopAppRoutes = lazy(() => import('./DesktopAppRoutes'))
const MobileAppRoutes = lazy(() => import('../mobile/routes/MobileAppRoutes'))

function PlatformLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        background: '#f0f4f8',
        color: '#122a58',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '0.9375rem',
        fontWeight: 600,
      }}
      role="status"
      aria-label="Loading application layout"
    >
      <div style={{ width: "min(42rem, calc(100% - 32px))" }}>
        <LoadingSkeleton label="Loading PolitikApp" rows={4} />
      </div>
    </div>
  )
}

export function PlatformRouter(props) {
  const isMobile = useIsMobile()

  return (
    <Suspense fallback={<PlatformLoadingFallback />}>
      {isMobile ? (
        <MobileAppRoutes {...props} />
      ) : (
        <DesktopAppRoutes {...props} />
      )}
    </Suspense>
  )
}

export default PlatformRouter

