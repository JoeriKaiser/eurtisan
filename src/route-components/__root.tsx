import { Outlet, useRouter } from '@tanstack/react-router'
import { lazy, Suspense, useCallback, useRef } from 'react'
import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { ObservabilityErrorBoundary } from '#/components/ObservabilityErrorBoundary'
import { m } from '#/paraglide/messages'
import { AnalyticsConsentBanner } from '../components/AnalyticsConsentBanner'
import CartProvider from '../components/CartProvider'
import Footer from '../components/Footer'
import Header from '../components/Header'

const Devtools = import.meta.env.DEV
  ? lazy(() => import('../components/Devtools').then((m) => ({ default: m.Devtools })))
  : null

const AUTH_ROUTES = new Set(['/signin', '/forgot-password', '/reset-password', '/verify-email'])
const LOCALES = new Set(['en', 'nl'])

function stripLocalePrefix(pathname: string): string {
  // Strip an optional locale prefix (e.g. /nl/admin) so route detection works
  // regardless of the active locale.
  const segments = pathname.split('/')
  if (segments[1] && LOCALES.has(segments[1])) {
    return segments.slice(2).join('/') === '' ? '/' : `/${segments.slice(2).join('/')}`
  }
  return pathname
}

function normalizeAuthRoute(pathname: string): string {
  const withoutLocale = stripLocalePrefix(pathname)
  return withoutLocale === '' ? '/' : withoutLocale
}

export function RootComponent() {
  const router = useRouter()
  const pathname = router.state.location.pathname
  const normalizedPathname = stripLocalePrefix(pathname)
  const isOnboarding = pathname.includes('/sell/onboarding/')
  const isAuthRoute = AUTH_ROUTES.has(normalizeAuthRoute(pathname))
  const isAdminRoute = normalizedPathname.startsWith('/admin')

  const { consent } = useAnalyticsConsent()
  const lastTrackedLocation = useRef<string | null>(null)

  const telemetryOwnerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || consent !== 'granted') return
      let disposed = false

      const trackLocation = async () => {
        const location = router.state.location
        const locationKey = `${location.pathname}${location.searchStr}`
        if (locationKey === lastTrackedLocation.current) return

        const { getFaro, initFaro } = await import('#/integrations/faro')
        if (disposed) return
        const faro = initFaro() ?? getFaro()
        if (!faro?.api || locationKey === lastTrackedLocation.current) return

        lastTrackedLocation.current = locationKey
        faro.api.pushEvent('route_change', {
          path: location.pathname,
          search: location.searchStr,
        })
      }

      void trackLocation()
      const unsubscribe = router.subscribe('onResolved', () => void trackLocation())
      return () => {
        disposed = true
        unsubscribe()
      }
    },
    [consent, router],
  )

  return (
    <ObservabilityErrorBoundary>
      <CartProvider>
        <div ref={telemetryOwnerRef} className='flex min-h-[100dvh] flex-col'>
          <a
            href='#main-content'
            className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-toast focus:px-4 focus:py-2 focus:bg-surface-default focus:text-text-primary focus:border focus:border-border-default focus:rounded-lg focus:shadow-md focus-visible:ring-2 focus-visible:ring-accent-secondary focus-visible:ring-offset-2 outline-none'
          >
            {m.nav_skip_to_content()}
          </a>
          {!isAdminRoute && <Header />}
          <div id='main-content' className='flex-1 outline-none' tabIndex={-1}>
            <Outlet />
          </div>
          {!isOnboarding && !isAdminRoute && <Footer />}
          {!isAuthRoute && <AnalyticsConsentBanner />}
          {Devtools && (
            <Suspense fallback={null}>
              <Devtools />
            </Suspense>
          )}
        </div>
      </CartProvider>
    </ObservabilityErrorBoundary>
  )
}
