import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { getPublicOperatorProfile } from '#/lib/legal/operator'
import PrivacyPage from '#/components/routes/PrivacyPage'

export const Route = createFileRoute('/privacy')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.privacy_title(),
      description: m.privacy_description(),
      canonicalPath: '/privacy',
    })
    return { meta, links }
  },
  loader: () => getPublicOperatorProfile(),
  component: function PrivacyRouteComponent() {
    const operator = Route.useLoaderData()
    return <PrivacyPage operator={operator} />
  },
})
