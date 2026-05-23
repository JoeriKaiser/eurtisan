import { useEffect } from 'react'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  ClientOnly,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'
import { getCurrentUser } from '#/lib/server-auth'
import { listCategories } from '#/lib/categories'
import CartProvider from '../components/CartProvider'
import Footer from '../components/Footer'
import Header from '../components/Header'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'
import { Outlet } from '@tanstack/react-router'

interface MyRouterContext {
  queryClient: QueryClient
}

function RootError({ error }: { error: Error }) {
  return (
    <div className='page-wrap px-4 py-20 text-center'>
      <h1 className='display-title mb-4 text-3xl font-bold text-text-primary'>
        Something went wrong
      </h1>
      <p className='mb-6 text-text-secondary'>{error.message}</p>
      <pre className='mx-auto max-w-2xl overflow-auto rounded-xl bg-surface-inset p-4 text-left text-xs text-text-secondary'>
        {error.stack}
      </pre>
    </div>
  )
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async () => {
    const [user, categories] = await Promise.all([
      getCurrentUser().catch(() => null),
      listCategories({ data: { tree: true } }).catch(() => []),
    ])
    return { user, categories }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: m.meta_title_default(),
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  errorComponent: RootError,
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const location = useLocation()
  const isOnboarding = location.pathname.includes('/sell/onboarding/')
  Route.useLoaderData()

  useEffect(() => {
    document.documentElement.setAttribute('data-hydrated', 'true')
  }, [])

  return (
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
            TanStackQueryDevtools,
          ]}
        />
      </ClientOnly>
    </CartProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <script src='/theme-init.js' />
        <HeadContent />
      </head>
      <body className='font-sans antialiased [overflow-wrap:anywhere]'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
