import { useLoaderData } from '@tanstack/react-router'

import ImprintPage from '#/components/routes/ImprintPage'

/**
 * Route component for /imprint. Lives in `route-components` (not the route
 * file) so TanStack's code splitter can keep it — and the ImprintPage subtree
 * — out of the eagerly loaded route-reference module.
 */
export function ImprintRouteComponent() {
  const operator = useLoaderData({ from: '/imprint' })
  return <ImprintPage operator={operator} />
}
