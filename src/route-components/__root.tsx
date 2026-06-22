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

export function RootComponent() {
  const router = useRouter()
  const isOnboarding = router.state.location.pathname.includes('/sell/onboarding/')

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
        <a
          href='#main-content'
          className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-toast focus:px-4 focus:py-2 focus:bg-surface-default focus:text-text-primary focus:border focus:border-border-default focus:rounded-lg focus:shadow-md outline-none'
        >
          {m.nav_skip_to_content()}
        </a>
        <Header />
        <main id='main-content' className='flex-1 outline-none' tabIndex={-1}>
          <Outlet />
        </main>
        {!isOnboarding && <Footer />}
        <AnalyticsConsentBanner />
        {Devtools && (
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        )}
      </CartProvider>
    </FaroErrorBoundary>
  )
}
