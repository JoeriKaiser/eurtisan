import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import {
  cart,
  cartItem,
  categories,
  dispute,
  disputeMessage,
  inventoryReservation,
  notification,
  orderItem,
  payout,
  platformOrder,
  product,
  productImage,
  review,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import {
  buildSitemapXml,
  buildUrlElement,
  generateSitemap,
  generateSitemapEntries,
  getSitemap,
} from './sitemap.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(disputeMessage)
  await db.delete(dispute)
  await db.delete(review)
  await db.delete(inventoryReservation)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(payout)
  await db.delete(notification)
  await db.delete(cartItem)
  await db.delete(cart)
  await db.delete(productImage)
  await db.delete(product)
  await db.delete(categories)
  await db.delete(shop)
  await db.delete(user)
})

describe('buildUrlElement', () => {
  it('generates a valid <url> XML element', () => {
    const entry = {
      loc: 'https://eurtisan.eu/',
      lastmod: '2026-05-14',
      changefreq: 'daily' as const,
      priority: '1.0',
    }

    const xml = buildUrlElement(entry)

    expect(xml).toContain('<url>')
    expect(xml).toContain('</url>')
    expect(xml).toContain('<loc>https://eurtisan.eu/</loc>')
    expect(xml).toContain('<lastmod>2026-05-14</lastmod>')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
  })

  it('escapes XML special characters in loc', () => {
    const entry = {
      loc: 'https://eurtisan.eu/search?q=foo&bar=<baz>',
      lastmod: '2026-05-14',
      changefreq: 'weekly' as const,
      priority: '0.5',
    }

    const xml = buildUrlElement(entry)
    expect(xml).toContain('&amp;')
    expect(xml).toContain('&lt;')
    expect(xml).toContain('&gt;')
  })
})

describe('buildSitemapXml', () => {
  it('generates a valid sitemap XML document', () => {
    const entries = [
      {
        loc: 'https://eurtisan.eu/',
        lastmod: '2026-05-14',
        changefreq: 'daily' as const,
        priority: '1.0',
      },
      {
        loc: 'https://eurtisan.eu/about',
        lastmod: '2026-05-14',
        changefreq: 'monthly' as const,
        priority: '0.5',
      },
    ]

    const xml = buildSitemapXml(entries)

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
    expect(xml).toContain('<loc>https://eurtisan.eu/</loc>')
    expect(xml).toContain('<loc>https://eurtisan.eu/about</loc>')
  })

  it('returns valid XML with empty entries array', () => {
    const xml = buildSitemapXml([])

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset')
    expect(xml).toContain('</urlset>')
  })
})

describe('generateSitemapEntries', () => {
  it('includes static pages', async () => {
    const entries = await generateSitemapEntries()

    const locs = entries.map((e) => e.loc.replace(/https?:\/\/[^/]+/, ''))
    expect(locs).toContain('/')
    expect(locs).toContain('/about')
    expect(locs).toContain('/category/all')
    expect(locs).toContain('/search')
  })

  it('prioritizes homepage at 1.0', async () => {
    const entries = await generateSitemapEntries()
    const homeEntry = entries.find(
      (e) =>
        e.loc.endsWith('/') &&
        !e.loc.includes('/about') &&
        !e.loc.includes('/category') &&
        !e.loc.includes('/search') &&
        !e.loc.includes('/shops') &&
        !e.loc.includes('/products'),
    )

    expect(homeEntry?.priority).toBe('1.0')
    expect(homeEntry?.changefreq).toBe('daily')
  })

  it('excludes suspended shops', async () => {
    // Create a suspended shop
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-suspended-owner',
        name: 'Suspended Owner',
        email: 'suspended@test.com',
      })
      .returning()

    await db.insert(shop).values({
      id: 'shop-suspended',
      name: 'Suspended Shop',
      slug: 'suspended-shop',
      ownerId: shopOwner.id,
      isSuspended: true,
    })

    const entries = await generateSitemapEntries()
    const suspendedUrl = entries.find((e) => e.loc.includes('/shops/suspended-shop'))

    expect(suspendedUrl).toBeUndefined()
  })

  it('excludes inactive products', async () => {
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-inactive-owner',
        name: 'Inactive Owner',
        email: 'inactive@test.com',
      })
      .returning()

    const [activeShop] = await db
      .insert(shop)
      .values({
        id: 'shop-for-inactive-product',
        name: 'Test Shop',
        slug: 'test-shop-inactive',
        ownerId: shopOwner.id,
        isSuspended: false,
      })
      .returning()

    await db.insert(product).values({
      id: 'product-inactive',
      name: 'Inactive Product',
      slug: 'inactive-product',
      priceCents: 1000,
      shopId: activeShop.id,
      isActive: false,
    })

    const entries = await generateSitemapEntries()
    const inactiveProductUrl = entries.find((e) => e.loc.includes('products/inactive-product'))

    expect(inactiveProductUrl).toBeUndefined()
  })

  it('includes active shops in sitemap', async () => {
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-active-owner',
        name: 'Active Owner',
        email: 'active@test.com',
      })
      .returning()

    await db.insert(shop).values({
      id: 'shop-active-1',
      name: 'Active Shop',
      slug: 'active-shop',
      ownerId: shopOwner.id,
      isSuspended: false,
    })

    const entries = await generateSitemapEntries()
    const shopUrl = entries.find((e) => e.loc.includes('/shops/active-shop'))

    expect(shopUrl).toBeDefined()
    expect(shopUrl?.changefreq).toBe('daily')
    expect(shopUrl?.priority).toBe('0.8')
  })

  it('includes active products from non-suspended shops', async () => {
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-product-owner',
        name: 'Product Owner',
        email: 'product@test.com',
      })
      .returning()

    const [activeShop] = await db
      .insert(shop)
      .values({
        id: 'shop-for-product',
        name: 'Product Shop',
        slug: 'product-shop',
        ownerId: shopOwner.id,
        isSuspended: false,
      })
      .returning()

    await db.insert(product).values({
      id: 'product-active-1',
      name: 'Active Product',
      slug: 'active-product',
      priceCents: 2000,
      shopId: activeShop.id,
      isActive: true,
    })

    const entries = await generateSitemapEntries()
    const productUrl = entries.find((e) => e.loc.includes('products/active-product'))

    expect(productUrl).toBeDefined()
    expect(productUrl?.changefreq).toBe('weekly')
    expect(productUrl?.priority).toBe('0.6')
  })

  it('includes categories with active products', async () => {
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-cat-owner',
        name: 'Cat Owner',
        email: 'cat@test.com',
      })
      .returning()

    const [activeShop] = await db
      .insert(shop)
      .values({
        id: 'shop-for-cat',
        name: 'Cat Shop',
        slug: 'cat-shop',
        ownerId: shopOwner.id,
        isSuspended: false,
      })
      .returning()

    const [category] = await db
      .insert(categories)
      .values({
        name: 'Test Category',
        slug: 'test-category',
      })
      .returning()

    await db.insert(product).values({
      id: 'product-in-cat',
      name: 'Categorized Product',
      slug: 'categorized-product',
      priceCents: 1500,
      shopId: activeShop.id,
      categoryId: category.id,
      isActive: true,
    })

    const entries = await generateSitemapEntries()
    const categoryUrl = entries.find((e) => e.loc.includes('/category/test-category'))

    expect(categoryUrl).toBeDefined()
    expect(categoryUrl?.changefreq).toBe('weekly')
    expect(categoryUrl?.priority).toBe('0.7')
  })

  it('excludes products from suspended shops', async () => {
    const [shopOwner] = await db
      .insert(user)
      .values({
        id: 'user-suspended-shop-owner',
        name: 'Suspended Shop Owner',
        email: 'suspended-shop-owner@test.com',
      })
      .returning()

    const [suspendedShop] = await db
      .insert(shop)
      .values({
        id: 'shop-suspended-2',
        name: 'Suspended Shop 2',
        slug: 'suspended-shop-2',
        ownerId: shopOwner.id,
        isSuspended: true,
      })
      .returning()

    await db.insert(product).values({
      id: 'product-in-suspended-shop',
      name: 'Product in Suspended Shop',
      slug: 'product-in-suspended-shop',
      priceCents: 500,
      shopId: suspendedShop.id,
      isActive: true,
    })

    const entries = await generateSitemapEntries()
    const productUrl = entries.find((e) => e.loc.includes('products/product-in-suspended-shop'))

    expect(productUrl).toBeUndefined()
  })
})

describe('generateSitemap', () => {
  it('returns a valid full sitemap XML string', async () => {
    const xml = await generateSitemap()

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
    // Static pages should always be present
    expect(xml).toContain('<loc>')
  })
})

describe('getSitemap', () => {
  it('returns a valid full sitemap XML string', async () => {
    const xml = await getSitemap()

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('</urlset>')
    expect(xml).toContain('<loc>')
  })
})
