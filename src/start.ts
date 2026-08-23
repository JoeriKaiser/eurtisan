import { createMiddleware, createStart } from '@tanstack/react-start'
import { paraglideMiddleware } from '#/paraglide/server'

// Sets the Paraglide locale async context from the request URL/cookie. The
// router's own `rewrite` option handles URL de-localization, so we pass the
// original request through; the middleware still makes `getLocale()` return the
// correct locale during SSR.
const paraglideRequestMiddleware = createMiddleware().server(async ({ request, next }) => {
  return paraglideMiddleware(request, async () => {
    return next()
  })
})

// Request middleware intentionally does not handle CSP. Per-request script
// nonces and the production Content-Security-Policy are owned exclusively by
// the Node entry point (`server-entry.mjs`) at the transport boundary;
// development ships without a CSP by design (see `src/lib/csp.ts`).

// startInstance is consumed by the TanStack Start Vite plugin at build time.
// It has no explicit importers in source — the plugin discovers it via heuristics.
export const startInstance = createStart(() => ({
  requestMiddleware: [paraglideRequestMiddleware],
}))
