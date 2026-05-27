import { useEffect } from 'react'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ClientOnly, HeadContent, Scripts, useLocation } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { FaroErrorBoundary } from '@grafana/faro-react'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { UmamiScript } from '#/integrations/umami'
import { initFaro, getFaro } from '#/integrations/faro'
import CartProvider from '../components/CartProvider'
import Footer from '../components/Footer'
import Header from '../components/Header'
import { Outlet } from '@tanstack/react-router'

export function RootError({ error }: { error: Error }) {
  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-semibold text-text-primary'>
        Something went wrong
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
        {error.stack}
      </pre>
    </div>
  )
}

export function RootComponent() {
  const location = useLocation()
  const isOnboarding = location.pathname.includes('/sell/onboarding/')

  // Initialize Faro as early as possible on the client
  useEffect(() => {
    initFaro()
  }, [])

  // Track route changes for RUM
  useEffect(() => {
    const faro = getFaro()
    if (faro?.api) {
      faro.api.pushEvent('route_change', {
        path: location.pathname,
        search: location.searchStr,
      })
    }
  }, [location.pathname, location.searchStr])

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

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script>{`(function(){try{var s=window.localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches,m=s==='light'||s==='dark'?s:d?'dark':'light',r=document.documentElement;r.classList.remove('light','dark');r.classList.add(m);r.setAttribute('data-theme',m);}catch(_e){}})();`}</script>
        <HeadContent />
        <UmamiScript />
      </head>
      <body className='font-sans antialiased [overflow-wrap:anywhere]'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
