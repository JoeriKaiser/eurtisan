import { useEffect } from 'react'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ClientOnly, useRouter } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { FaroErrorBoundary } from '@grafana/faro-react'
import { m } from '#/paraglide/messages'
import { initFaro, getFaro } from '#/integrations/faro'
import CartProvider from '../components/CartProvider'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { Outlet } from '@tanstack/react-router'

export function RootComponent() {
  const router = useRouter()
  const isOnboarding = router.state.location.pathname.includes('/sell/onboarding/')

  // Initialize Faro as early as possible on the client
  useEffect(() => {
    initFaro()
  }, [])

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
        <ClientOnly>
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              {
                name: 'Tanstack Query',
                render: <ReactQueryDevtoolsPanel />,
              },
            ]}
          />
        </ClientOnly>
      </CartProvider>
    </FaroErrorBoundary>
  )
}
