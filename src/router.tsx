import {
  createRouter as createTanStackRouter,
  type NotFoundRouteComponent,
} from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { deLocalizeUrl, localizeUrl } from '#/paraglide/runtime'
import { getContext } from './integrations/tanstack-query/root-provider'
import { NotFoundPage } from '#/components/NotFoundPage'
import { routeTree } from './routeTree.gen'

// Cast avoids a type-level circularity: the component imports from the module
// that this file augments below, so we present it as the expected route slot type.
const DefaultNotFoundComponent = NotFoundPage as NotFoundRouteComponent

export function getRouter() {
  const context = getContext()

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    defaultNotFoundComponent: DefaultNotFoundComponent,
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
