import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RootComponent, RootDocument, RootError } from '#/route-components/__root'
import { getCurrentUser } from '#/lib/server-auth'
import { listCategories } from '#/lib/categories'
import appCss from '../styles.css?url'
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
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  errorComponent: RootError,
  component: RootComponent,
  shellComponent: RootDocument,
})
