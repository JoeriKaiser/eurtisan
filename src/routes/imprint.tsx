import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { getPublicOperatorProfile } from '#/lib/legal/operator'
import ImprintPage from '#/components/routes/ImprintPage'

export const Route = createFileRoute('/imprint')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.imprint_title(),
      description: m.imprint_description(),
      canonicalPath: '/imprint',
    })
    return { meta, links }
  },
  loader: () => getPublicOperatorProfile(),
  component: function ImprintRouteComponent() {
    const operator = Route.useLoaderData()
    return <ImprintPage operator={operator} />
  },
})
