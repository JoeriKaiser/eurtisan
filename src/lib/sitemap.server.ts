import { and, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { categories, product, shop } from '#/db/schema'

/**
 * Base URL for absolute sitemap URLs.
 * Uses PUBLIC_URL env var when set, otherwise falls back to localhost.
 */
function getBaseUrl(): string {
  if (typeof process !== 'undefined') {
    const publicUrl = process.env.PUBLIC_URL
    if (publicUrl) {
      return publicUrl.replace(/\/+$/, '')
    }
  }
  return 'http://localhost:3000'
}

const BASE_URL = getBaseUrl()

/** Sitemap entry with its metadata. */
export interface SitemapEntry {
  loc: string
  lastmod: string
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: string
}

/**
 * Formats a Date to a W3C date string (YYYY-MM-DD).
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Escapes special XML characters in a string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Builds a single <url> XML element for a sitemap entry.
 */
export function buildUrlElement(entry: SitemapEntry): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    `    <lastmod>${entry.lastmod}</lastmod>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>',
  ].join('\n')
}

/**
 * Builds the complete sitemap XML string from a list of entries.
 */
export function buildSitemapXml(entries: SitemapEntry[]): string {
  const header = '<?xml version="1.0" encoding="UTF-8"?>'
  const open = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  const close = '</urlset>'
  const body = entries.map(buildUrlElement).join('\n')

  return `${header}\n${open}\n${body}\n${close}\n`
}

/**
 * Generates the full sitemap entry set.
 *
 * Includes:
 * - Static pages: homepage, about, category directory, search
 * - All active (non-suspended) shops
 * - All active products from non-suspended shops
 * - All categories with published products
 *
 * Suspended shops and inactive products are excluded.
 */
export async function generateSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = []
  const now = new Date()
  const nowStr = formatDate(now)

  // === Static pages ===

  entries.push({
    loc: `${BASE_URL}/`,
    lastmod: nowStr,
    changefreq: 'daily',
    priority: '1.0',
  })

  entries.push({
    loc: `${BASE_URL}/about`,
    lastmod: nowStr,
    changefreq: 'monthly',
    priority: '0.5',
  })

  entries.push({
    loc: `${BASE_URL}/category/all`,
    lastmod: nowStr,
    changefreq: 'weekly',
    priority: '0.8',
  })

  entries.push({
    loc: `${BASE_URL}/search`,
    lastmod: nowStr,
    changefreq: 'weekly',
    priority: '0.4',
  })

  // === Active shops ===

  const activeShops = await db
    .select({
      slug: shop.slug,
      updatedAt: shop.updatedAt,
    })
    .from(shop)
    .where(eq(shop.isSuspended, false))

  for (const s of activeShops) {
    entries.push({
      loc: `${BASE_URL}/shops/${s.slug}`,
      lastmod: s.updatedAt ? formatDate(s.updatedAt) : nowStr,
      changefreq: 'daily',
      priority: '0.8',
    })
  }

  // === Active products from non-suspended shops ===

  const activeProducts = await db
    .select({
      slug: product.slug,
      shopSlug: shop.slug,
      updatedAt: product.updatedAt,
    })
    .from(product)
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(and(eq(product.isActive, true), eq(shop.isSuspended, false)))

  for (const p of activeProducts) {
    entries.push({
      loc: `${BASE_URL}/products/${p.slug}`,
      lastmod: p.updatedAt ? formatDate(p.updatedAt) : nowStr,
      changefreq: 'weekly',
      priority: '0.6',
    })
  }

  // === Categories (only those that have active products) ===

  // We fetch categories that have at least one active product from a non-suspended shop
  const activeCategories = await db
    .selectDistinct({
      slug: categories.slug,
    })
    .from(categories)
    .innerJoin(product, eq(product.categoryId, categories.id))
    .innerJoin(shop, eq(product.shopId, shop.id))
    .where(and(eq(product.isActive, true), eq(shop.isSuspended, false)))

  for (const c of activeCategories) {
    entries.push({
      loc: `${BASE_URL}/category/${c.slug}`,
      lastmod: nowStr,
      changefreq: 'weekly',
      priority: '0.7',
    })
  }

  return entries
}

/**
 * Generates the complete sitemap XML string.
 */
export async function generateSitemap(): Promise<string> {
  const entries = await generateSitemapEntries()
  return buildSitemapXml(entries)
}

// In-memory cache for 24 hours
let cachedSitemap: string | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Returns the sitemap XML, using a 24-hour in-memory cache.
 * Cache is bypassed if expired, and regenerated on next call.
 */
export async function getSitemap(): Promise<string> {
  const now = Date.now()
  if (cachedSitemap && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSitemap
  }

  cachedSitemap = await generateSitemap()
  cacheTimestamp = now
  return cachedSitemap
}

/**
 * Clears the sitemap cache (useful for testing).
 */
export function clearSitemapCache(): void {
  cachedSitemap = null
  cacheTimestamp = 0
}
