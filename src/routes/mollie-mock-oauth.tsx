import { createFileRoute, notFound } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import z from 'zod'

const LazyMollieMockOauth = lazy(() =>
  import('#/route-components/mollie-mock-oauth').then((module) => ({
    default: module.MollieMockOauth,
  })),
)

/**
 * Dev-only mock Mollie Connect authorization page.
 *
 * - `beforeLoad` throws `notFound()` in production builds so the route is
 *   unreachable on a live site.
 * - The mock UI component is lazy-loaded so it is not included in the
 *   production client bundle; it is only fetched in development.
 */
export const Route = createFileRoute('/mollie-mock-oauth')({
  validateSearch: z.object({
    shopId: z.string(),
    state: z.string().optional(),
    redirect_uri: z.string(),
  }),
  beforeLoad: () => {
    if (import.meta.env.PROD) {
      throw notFound()
    }
  },
  component: () => {
    const search = Route.useSearch()
    return (
      <Suspense fallback={null}>
        <LazyMollieMockOauth {...search} />
      </Suspense>
    )
  },
})
