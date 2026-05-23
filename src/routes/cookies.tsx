import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
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
  component: CookiesPage,
})
