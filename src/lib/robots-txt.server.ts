import { getBaseUrl } from './env.server'

/**
 * Builds the robots.txt content.
 *
 * Allows crawling of all public-facing routes. Disallows crawling of
 * private/functional routes: cart, checkout, creator dashboard, admin, API, and orders.
 */
export function buildRobotsTxt(): string {
  const baseUrl = getBaseUrl()
  const lines = [
    'User-agent: *',
    '',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /creator',
    'Disallow: /admin',
    'Disallow: /api',
    'Disallow: /orders',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ]
  return lines.join('\n')
}
