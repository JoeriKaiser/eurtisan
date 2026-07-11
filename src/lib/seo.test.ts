import { describe, expect, it, vi } from 'vitest'

// Mock paraglide messages before importing the module under test
vi.mock('#/paraglide/messages', () => ({
  m: {
    meta_default_description: () =>
      'Discover unique, handcrafted pieces from independent makers across Europe.',
  },
}))

import { createPageMeta } from './seo'

describe('createPageMeta', () => {
  it('returns meta, links, and defaults for a basic page', () => {
    const result = createPageMeta({
      title: 'About | Eurtisan',
      description: 'Learn about our marketplace.',
      canonicalPath: '/about',
    })

    expect(result.meta).toBeInstanceOf(Array)
    expect(result.links).toBeInstanceOf(Array)

    const titleEntry = result.meta.find((m) => m.title === 'About | Eurtisan')
    expect(titleEntry).toBeDefined()

    const descEntry = result.meta.find((m) => m.name === 'description')
    expect(descEntry?.content).toBe('Learn about our marketplace.')

    const canonical = result.links.find((l) => l.rel === 'canonical')
    expect(canonical?.href).toBe('/about')
  })

  it('includes Open Graph tags', () => {
    const result = createPageMeta({
      title: 'Product | Eurtisan',
      description: 'A beautiful handmade product.',
      canonicalPath: '/products/vase',
    })

    const ogTitle = result.meta.find((m) => m.property === 'og:title')
    expect(ogTitle?.content).toBe('Product | Eurtisan')

    const ogDescription = result.meta.find((m) => m.property === 'og:description')
    expect(ogDescription?.content).toBe('A beautiful handmade product.')

    const ogType = result.meta.find((m) => m.property === 'og:type')
    expect(ogType?.content).toBe('website')

    const ogUrl = result.meta.find((m) => m.property === 'og:url')
    expect(ogUrl?.content).toBe('/products/vase')

    const ogImage = result.meta.find((m) => m.property === 'og:image')
    expect(ogImage?.content).toBe('/logo512.png')

    const ogSiteName = result.meta.find((m) => m.property === 'og:site_name')
    expect(ogSiteName?.content).toBe('Eurtisan')
  })

  it('uses custom ogImageUrl when provided', () => {
    const result = createPageMeta({
      title: 'Shop | Eurtisan',
      description: 'A great shop.',
      canonicalPath: '/shops/my-shop',
      ogImageUrl: '/uploads/banner.jpg',
    })

    const ogImage = result.meta.find((m) => m.property === 'og:image')
    expect(ogImage?.content).toBe('/uploads/banner.jpg')
  })

  it('overrides ogType', () => {
    const result = createPageMeta({
      title: 'Product | Eurtisan',
      description: 'A product.',
      canonicalPath: '/products/vase',
      ogType: 'product',
    })

    const ogType = result.meta.find((m) => m.property === 'og:type')
    expect(ogType?.content).toBe('product')
  })

  it('adds product price OG tags when productPrice is provided', () => {
    const result = createPageMeta({
      title: 'Product | Eurtisan',
      description: 'A product.',
      canonicalPath: '/products/vase',
      ogType: 'product',
      productPrice: { amount: '29.99', currency: 'EUR' },
    })

    const priceAmount = result.meta.find((m) => m.property === 'og:price:amount')
    expect(priceAmount?.content).toBe('29.99')

    const priceCurrency = result.meta.find((m) => m.property === 'og:price:currency')
    expect(priceCurrency?.content).toBe('EUR')
  })

  it('does not include product price OG tags when productPrice is not provided', () => {
    const result = createPageMeta({
      title: 'About | Eurtisan',
      description: 'About page.',
      canonicalPath: '/about',
    })

    const priceAmount = result.meta.find((m) => m.property === 'og:price:amount')
    expect(priceAmount).toBeUndefined()

    const priceCurrency = result.meta.find((m) => m.property === 'og:price:currency')
    expect(priceCurrency).toBeUndefined()
  })

  it('includes JSON-LD structured data when jsonLd is provided', () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Handmade Vase',
    }

    const result = createPageMeta({
      title: 'Product | Eurtisan',
      description: 'A product.',
      canonicalPath: '/products/vase',
      jsonLd,
    })

    expect(result.script).toBeInstanceOf(Array)
    expect(result.script).toHaveLength(1)
    expect(result.script?.[0].type).toBe('application/ld+json')
    const parsed = JSON.parse(result.script?.[0].children as string)
    expect(parsed['@type']).toBe('Product')
    expect(parsed.name).toBe('Handmade Vase')
  })

  it('escapes </script> inside JSON-LD to prevent XSS', () => {
    const maliciousJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: '</script><script>alert(1)</script>',
    }

    const result = createPageMeta({
      title: 'Product | Eurtisan',
      description: 'A product.',
      canonicalPath: '/products/vase',
      jsonLd: maliciousJsonLd,
    })

    const scriptContent = result.script?.[0].children as string
    expect(scriptContent).not.toContain('</script>')
    expect(scriptContent).toContain('\\u003c/script>')

    // Must still be valid JSON
    const parsed = JSON.parse(scriptContent)
    expect(parsed.name).toBe('</script><script>alert(1)</script>')
  })

  it('does not include script when jsonLd is not provided', () => {
    const result = createPageMeta({
      title: 'About | Eurtisan',
      description: 'About page.',
      canonicalPath: '/about',
    })

    expect(result.script).toBeUndefined()
  })

  it('falls back to default OG image when ogImageUrl is undefined', () => {
    const result = createPageMeta({
      title: 'Page | Eurtisan',
      description: 'A page.',
      canonicalPath: '/page',
    })

    const ogImage = result.meta.find((m) => m.property === 'og:image')
    expect(ogImage?.content).toBe('/logo512.png')
  })

  it('falls back to default OG image when ogImageUrl is an empty string', () => {
    const result = createPageMeta({
      title: 'Page | Eurtisan',
      description: 'A page.',
      canonicalPath: '/page',
      ogImageUrl: '',
    })

    // createPageMeta treats empty string as undefined → falls back to default
    const ogImage = result.meta.find((m) => m.property === 'og:image')
    expect(ogImage?.content).toBe('/logo512.png')
  })

  it('generates canonical link with the provided path', () => {
    const result = createPageMeta({
      title: 'Search | Eurtisan',
      description: 'Search results.',
      canonicalPath: '/search?q=vase',
    })

    const canonical = result.links.find((l) => l.rel === 'canonical')
    expect(canonical?.href).toBe('/search?q=vase')
  })

  it('reads PUBLIC_URL when metadata is generated', () => {
    const previousPublicUrl = process.env.PUBLIC_URL
    process.env.PUBLIC_URL = 'https://eurtisan.example'

    try {
      const result = createPageMeta({
        title: 'About | Eurtisan',
        description: 'Learn about our marketplace.',
        canonicalPath: '/about',
      })

      expect(result.links.find((link) => link.rel === 'canonical')?.href).toBe(
        'https://eurtisan.example/about',
      )
    } finally {
      if (previousPublicUrl === undefined) {
        delete process.env.PUBLIC_URL
      } else {
        process.env.PUBLIC_URL = previousPublicUrl
      }
    }
  })
})
