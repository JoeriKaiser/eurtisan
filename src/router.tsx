import {
  createRouter as createTanStackRouter,
  type NotFoundRouteComponent,
} from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { deLocalizeUrl, extractLocaleFromUrl, localizeUrl } from '#/paraglide/runtime'
import { getContext } from './integrations/tanstack-query/root-provider'
import { resolveNavigationTransitionTypes } from './lib/view-transitions'
import { NotFoundPage } from '#/components/NotFoundPage'
import { routeTree } from './routeTree.gen'

// Cast avoids a type-level circularity: the component imports from the module
// that this file augments below, so we present it as the expected route slot type.
const DefaultNotFoundComponent = NotFoundPage as NotFoundRouteComponent

export function getRouter() {
  const context = getContext()
  // Capture the locale detected from the incoming URL so that output rewriting
  // can re-apply the same locale prefix for canonical URLs and redirects.
  // This is scoped to a single router instance, which TanStack Start creates
  // per request, so concurrent requests do not share this value.
  let requestLocale: ReturnType<typeof extractLocaleFromUrl> | undefined

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 30_000,
    defaultViewTransition: {
      types: ({ fromLocation, toLocation, pathChanged }) =>
        resolveNavigationTransitionTypes({
          fromPathname: fromLocation?.pathname,
          toPathname: toLocation.pathname,
          pathChanged,
        }),
    },
    defaultNotFoundComponent: DefaultNotFoundComponent,
    rewrite: {
      input: ({ url }) => {
        requestLocale = extractLocaleFromUrl(url.href)
        return deLocalizeUrl(url)
      },
      output: ({ url }) => {
        const rewritten = localizeUrl(url, { locale: requestLocale })
        // Paraglide localizes the root path to `/nl/`; keep `/nl` canonical.
        if (rewritten.pathname.endsWith('/') && rewritten.pathname.length > 1) {
          rewritten.pathname = rewritten.pathname.slice(0, -1)
        }
        return rewritten
      },
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
