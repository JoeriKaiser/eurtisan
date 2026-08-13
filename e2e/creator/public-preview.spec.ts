import { waitForAppHydration } from '../fixtures/hydration'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { getCreatorShop } from '../fixtures/orders'

const E2E_PREFIX = 'E2E Public Preview'

interface PreviewProduct {
  id: string
  name: string
  slug: string
  description: string | null
}

async function findPublishedProductWithDescription(shopId: string): Promise<PreviewProduct | null> {
  const result = await db
    .select({
      id: schema.product.id,
      name: schema.product.name,
      slug: schema.product.slug,
      description: schema.product.description,
    })
    .from(schema.product)
    .where(
      and(
        eq(schema.product.shopId, shopId),
        eq(schema.product.status, 'published'),
        eq(schema.product.isActive, true),
        isNotNull(schema.product.description),
      ),
    )
    .limit(1)
  return result[0] ?? null
}

async function createFixtureProduct({
  name,
  status,
  shopId,
  description = '',
}: {
  name: string
  status: 'draft' | 'published' | 'archived'
  shopId: string
  description?: string
}): Promise<PreviewProduct> {
  const slug = `e2e-public-preview-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-${Date.now()}-${randomUUID().slice(0, 6)}`

  const [product] = await db
    .insert(schema.product)
    .values({
      id: randomUUID(),
      name,
      slug,
      description,
      priceCents: 2999,
      stockCount: 10,
      isActive: status === 'published',
      status,
      publishedAt: status === 'published' ? new Date() : null,
      shopId,
      vatRateCategory: 'standard',
      weightGrams: 100,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
    })
    .returning({ id: schema.product.id })

  return { id: product.id, name, slug, description }
}

test.describe('creator public shop preview', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  const createdProductIds: string[] = []

  test.afterAll(async () => {
    if (createdProductIds.length > 0) {
      await db.delete(schema.product).where(inArray(schema.product.id, createdProductIds))
    }
  })

  test('public shop page and product detail render, and unpublished products stay hidden', async ({
    page,
  }) => {
    const shop = await getCreatorShop()

    let publishedProduct = await findPublishedProductWithDescription(shop.id)
    if (!publishedProduct) {
      const created = await createFixtureProduct({
        name: `${E2E_PREFIX} Published Product`,
        status: 'published',
        shopId: shop.id,
        description: 'A beautifully crafted preview product for E2E testing.',
      })
      createdProductIds.push(created.id)
      publishedProduct = created
    }

    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { level: 1, name: shop.name })).toBeVisible()
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()

    const productCard = page
      .getByLabel(/^Product:/)
      .filter({ hasText: publishedProduct.name })
      .first()
    await expect(productCard).toBeVisible()

    await productCard.click()
    await page.waitForURL(/\/shops\/[^/]+\/products\/[^/]+/)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1, name: publishedProduct.name })).toBeVisible()
    await expect(page.getByText(/€/).first()).toBeVisible()
    if (publishedProduct.description) {
      await expect(page.getByText(publishedProduct.description)).toBeVisible()
    }

    const hiddenProduct = await createFixtureProduct({
      name: `${E2E_PREFIX} Hidden Draft`,
      status: 'draft',
      shopId: shop.id,
      description: 'This draft product should not appear on the public shop page.',
    })
    createdProductIds.push(hiddenProduct.id)

    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    await expect(page.getByLabel(/^Product:/).filter({ hasText: hiddenProduct.name })).toHaveCount(
      0,
    )
  })
})
