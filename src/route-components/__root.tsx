import { FaroErrorBoundary } from '@grafana/faro-react'
import { Outlet, useRouter } from '@tanstack/react-router'
import { lazy, Suspense, useEffect } from 'react'
import { useAnalyticsConsent } from '#/hooks/use-analytics-consent'
import { getFaro, initFaro } from '#/integrations/faro'
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

  // Initialize Faro only after the user has granted analytics consent.
  useEffect(() => {
    if (consent === 'granted') {
      initFaro()
    }
  }, [consent])

  // Track route changes for RUM
  useEffect(() => {
    const handleRouteChange = () => {
      const faro = getFaro()
      if (faro?.api) {
        faro.api.pushEvent('route_change', {
          path: router.state.location.pathname,
          search: router.state.location.searchStr,
        })
      }
    }
    handleRouteChange()
    return router.subscribe('onResolved', handleRouteChange)
  }, [router])

  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', 'true')
  }, [])

  // Register PWA service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister()
          }
        })
      }
    }
  }, [])

  return (
    <FaroErrorBoundary>
      <CartProvider>
        <div className='flex min-h-[100dvh] flex-col'>
          <a
            href='#main-content'
            className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-toast focus:px-4 focus:py-2 focus:bg-surface-default focus:text-text-primary focus:border focus:border-border-default focus:rounded-lg focus:shadow-md outline-none'
          >
            {m.nav_skip_to_content()}
          </a>
          {!isAdminRoute && <Header />}
          <main id='main-content' className='flex-1 outline-none' tabIndex={-1}>
            <Outlet />
          </main>
          {!isOnboarding && !isAdminRoute && <Footer />}
          {!isAuthRoute && <AnalyticsConsentBanner />}
          {Devtools && (
            <Suspense fallback={null}>
              <Devtools />
            </Suspense>
          )}
        </div>
      </CartProvider>
    </FaroErrorBoundary>
  )
}
