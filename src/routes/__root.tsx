import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RootComponent, RootDocument, RootError } from '#/route-components/__root'
import { getCurrentUser } from '#/lib/server-auth'
import { listCategories } from '#/lib/categories'
import '../styles.css'
import { m } from '#/paraglide/messages'

interface MyRouterContext {
  queryClient: QueryClient
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
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap',
      },
    ],
  }),
  errorComponent: RootError,
  component: RootComponent,
  shellComponent: RootDocument,
})
