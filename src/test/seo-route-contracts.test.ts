import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createPageMeta,
  createPrivateLayoutMeta,
  createRootMeta,
  createUtilityMeta,
} from '#/lib/seo'

/**
 * Guards the Document Head and SEO metadata architecture across route classifications.
 *
 * Verifies that:
 * 1. Public indexable pages produce full Open Graph and Twitter Card tags
 *    (preventing blank previews in Facebook, X/Twitter, LinkedIn, Discord, Slack, Mastodon, Bluesky),
 *    plus canonical and hreflang alternate links, and never emit `noindex`.
 * 2. Utility and auth pages produce branded social preview cards but explicitly enforce
 *    `robots: noindex, nofollow` to prevent search engine indexing.
 * 3. Private administrative and studio layouts declare `noindex, nofollow` at the layout level.
 * 4. Root document head provides baseline fallback social metadata without emitting canonical
 *    or hreflang links (which must only be emitted by leaf routes).
 * 5. Primary route files adhere to their classification contracts.
 */

describe('SEO & Document Head Metadata Contracts', () => {
  describe('createPageMeta (public indexable pages)', () => {
    const metaResult = createPageMeta({
      title: 'Handmade Wooden Bowl | Eurtisan',
      description: 'Handcrafted oak bowl made in France.',
      canonicalPath: '/products/handmade-wooden-bowl',
      ogImageUrl: 'https://eurtisan.eu/images/bowl.jpg',
    })

    it('generates essential Open Graph tags for Facebook, LinkedIn, Discord, Slack', () => {
      const og = new Map(
        metaResult.meta.filter((m) => m.property).map((m) => [m.property, m.content]),
      )

      expect(og.get('og:title')).toBe('Handmade Wooden Bowl | Eurtisan')
      expect(og.get('og:description')).toBe('Handcrafted oak bowl made in France.')
      expect(og.get('og:type')).toBe('website')
      expect(og.get('og:url')).toContain('/products/handmade-wooden-bowl')
      expect(og.get('og:image')).toBe('https://eurtisan.eu/images/bowl.jpg')
      expect(og.get('og:site_name')).toBe('Eurtisan')
    })

    it('generates essential Twitter Card tags for X/Twitter preview', () => {
      const twitter = new Map(metaResult.meta.filter((m) => m.name).map((m) => [m.name, m.content]))

      expect(twitter.get('twitter:card')).toBe('summary_large_image')
      expect(twitter.get('twitter:title')).toBe('Handmade Wooden Bowl | Eurtisan')
      expect(twitter.get('twitter:description')).toBe('Handcrafted oak bowl made in France.')
      expect(twitter.get('twitter:image')).toBe('https://eurtisan.eu/images/bowl.jpg')
      expect(twitter.get('twitter:url')).toContain('/products/handmade-wooden-bowl')
    })
    it('generates canonical and hreflang alternate links', () => {
      const canonical = metaResult.links.find((l) => l.rel === 'canonical')
      expect(canonical?.href).toContain('/products/handmade-wooden-bowl')

      const xDefault = metaResult.links.find(
        (l) => l.rel === 'alternate' && l.hreflang === 'x-default',
      )
      expect(xDefault?.href).toBeDefined()
    })

    it('never emits robots noindex on public indexable pages', () => {
      const robots = metaResult.meta.find((m) => m.name === 'robots')
      expect(robots).toBeUndefined()
    })
  })

  describe('createUtilityMeta (auth & utility pages)', () => {
    const utilityResult = createUtilityMeta({
      title: 'Sign in | Eurtisan',
      description: 'Enter your email and password to sign in.',
    })

    it('enforces robots noindex, nofollow for search crawlers', () => {
      const robots = utilityResult.meta.find((m) => m.name === 'robots')
      expect(robots?.content).toBe('noindex, nofollow')
    })

    it('generates branded Open Graph and Twitter tags for chat link previews', () => {
      const ogTitle = utilityResult.meta.find((m) => m.property === 'og:title')
      const twitterTitle = utilityResult.meta.find((m) => m.name === 'twitter:title')
      const twitterCard = utilityResult.meta.find((m) => m.name === 'twitter:card')

      expect(ogTitle?.content).toBe('Sign in | Eurtisan')
      expect(twitterTitle?.content).toBe('Sign in | Eurtisan')
      expect(twitterCard?.content).toBe('summary_large_image')
    })

    it('does not emit canonical or hreflang links', () => {
      expect(utilityResult.links).toEqual([])
    })
  })

  describe('createPrivateLayoutMeta (admin & studio layouts)', () => {
    const layoutResult = createPrivateLayoutMeta()

    it('enforces robots noindex, nofollow', () => {
      const robots = layoutResult.meta.find((m) => m.name === 'robots')
      expect(robots?.content).toBe('noindex, nofollow')
    })
  })

  describe('createRootMeta (platform baseline in __root.tsx)', () => {
    const rootResult = createRootMeta()

    it('contains baseline viewport, charset, title, description, and social fallbacks', () => {
      const hasCharset = rootResult.meta.some((m) => 'charSet' in m && m.charSet === 'utf-8')
      const hasViewport = rootResult.meta.some(
        (m) => m.name === 'viewport' && m.content === 'width=device-width, initial-scale=1',
      )
      const hasTitle = rootResult.meta.some((m) => 'title' in m && typeof m.title === 'string')
      const hasOgImage = rootResult.meta.some((m) => m.property === 'og:image')
      const hasTwitterCard = rootResult.meta.some(
        (m) => m.name === 'twitter:card' && m.content === 'summary_large_image',
      )

      expect(hasCharset).toBe(true)
      expect(hasViewport).toBe(true)
      expect(hasTitle).toBe(true)
      expect(hasOgImage).toBe(true)
      expect(hasTwitterCard).toBe(true)
    })

    it('does not emit canonical or hreflang links at the root level', () => {
      // Root meta must not emit links to prevent duplicate canonical tags when merged
      expect(rootResult.links).toBeUndefined()
    })
  })

  describe('Static route file compliance', () => {
    it('public catalog routes define createPageMeta', () => {
      const categorySlugSource = readFileSync('src/routes/category/$slug.tsx', 'utf8')
      const categoryAllSource = readFileSync('src/routes/category/all.tsx', 'utf8')

      expect(categorySlugSource).toContain('createPageMeta')
      expect(categorySlugSource).toContain('head:')

      expect(categoryAllSource).toContain('createPageMeta')
      expect(categoryAllSource).toContain('head:')
    })

    it('auth routes define createUtilityMeta with noindex', () => {
      const signinSource = readFileSync('src/routes/signin.tsx', 'utf8')
      const forgotPasswordSource = readFileSync('src/routes/forgot-password.tsx', 'utf8')
      const resetPasswordSource = readFileSync('src/routes/reset-password.tsx', 'utf8')

      expect(signinSource).toContain('createUtilityMeta')
      expect(signinSource).toContain('head:')

      expect(forgotPasswordSource).toContain('createUtilityMeta')
      expect(forgotPasswordSource).toContain('head:')

      expect(resetPasswordSource).toContain('createUtilityMeta')
      expect(resetPasswordSource).toContain('head:')
    })

    it('private layouts define createPrivateLayoutMeta', () => {
      const adminLayoutSource = readFileSync('src/routes/admin/route.tsx', 'utf8')
      const studioLayoutSource = readFileSync('src/routes/studio/route.tsx', 'utf8')

      expect(adminLayoutSource).toContain('createPrivateLayoutMeta')
      expect(adminLayoutSource).toContain('head:')

      expect(studioLayoutSource).toContain('createPrivateLayoutMeta')
      expect(studioLayoutSource).toContain('head:')
    })
  })
})
