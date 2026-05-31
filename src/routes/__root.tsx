import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { listCategories } from '#/lib/categories'
import { getCurrentUser } from '#/lib/server-auth'
import { RootComponent } from '#/route-components/__root'
import { RootDocument } from '#/route-components/root/RootDocument'
import { RootError } from '#/route-components/root/RootError'
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
        rel: 'preload',
        as: 'style',
        href: '/fonts/fonts.css',
      },
      {
        rel: 'stylesheet',
        href: '/fonts/fonts.css',
      },
    ],
  }),
  errorComponent: RootError,
  component: RootComponent,
  shellComponent: RootDocument,
})
