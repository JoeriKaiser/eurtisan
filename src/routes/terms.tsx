import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { getPublicOperatorProfile } from '#/lib/legal/operator'
import TermsPage from '#/components/routes/TermsPage'

export const Route = createFileRoute('/terms')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.terms_title(),
      description: m.terms_description(),
      canonicalPath: '/terms',
    })
    return { meta, links }
  },
  loader: () => getPublicOperatorProfile(),
  component: function TermsRouteComponent() {
    const operator = Route.useLoaderData()
    return <TermsPage operator={operator} />
  },
})
