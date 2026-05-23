import { createFileRoute } from '@tanstack/react-router'
import { createPageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages'
import AboutPage from '#/components/routes/AboutPage'

export const Route = createFileRoute('/about')({
  head: () => {
    const { meta, links } = createPageMeta({
      title: m.about_title(),
      description: m.about_description(),
      canonicalPath: '/about',
    })
    return { meta, links }
  },
  component: AboutPage,
})
