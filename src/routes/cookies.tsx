import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import { getPublicOperatorProfile } from '#/lib/legal/operator'
import CookiesPage from '#/components/routes/CookiesPage'

export const Route = createFileRoute('/cookies')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.cookies_title(),
      description: m.cookies_description(),
      canonicalPath: '/cookies',
    })
    return { meta, links }
  },
  loader: () => getPublicOperatorProfile(),
  component: function CookiesRouteComponent() {
    const operator = Route.useLoaderData()
    return <CookiesPage operator={operator} />
  },
})
