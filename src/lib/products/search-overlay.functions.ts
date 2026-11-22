import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { createMemoryIpRateLimitMiddleware } from '../rate-limit'

const searchOverlayRateLimitMiddleware = createMemoryIpRateLimitMiddleware(
  120,
  60_000,
  'search-overlay',
)

/**
 * Overlay suggestions: products, category facets, and engine highlighting in
 * one round trip. The Meilisearch credentials never reach the browser.
 */
export const searchOverlay = createServerFn({
  method: 'GET',
})
  .middleware([searchOverlayRateLimitMiddleware])
  .validator(z.object({ query: z.string().min(1).max(255) }))
  .handler(async ({ data }) => {
    const { searchOverlayQuery } = await import('./search-overlay.server')
    return searchOverlayQuery(data.query)
  })
