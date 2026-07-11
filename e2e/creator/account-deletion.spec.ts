import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import type { TestCreator } from '../fixtures/creators'
import {
  createCreatorShop,
  createVerifiedCreator,
  deleteCreatorByEmail,
  deleteCreatorShop,
} from '../fixtures/creators'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('creator account deletion side effects', () => {
  let creator: TestCreator
  let shop: { id: string; slug: string; name: string }
  let productName: string
  let productSlug: string

  test.beforeAll(async () => {
    const seed = `account-deletion-${Date.now()}`
    creator = await createVerifiedCreator(seed)
    shop = await createCreatorShop(creator, seed)

    // The fixture creates an approved shop; public visibility requires active.
    await db.update(schema.shop).set({ status: 'active' }).where(eq(schema.shop.id, shop.id))

    productName = `E2E Deletion Product ${seed}`
    productSlug = `e2e-deletion-product-${seed}`
    await db.insert(schema.product).values({
      id: randomUUID(),
      name: productName,
      slug: productSlug,
      priceCents: 2999,
      stockCount: 10,
      isActive: true,
      status: 'published',
      publishedAt: new Date(),
      shopId: shop.id,
      vatRateCategory: 'standard',
    })
  })

  test.afterAll(async () => {
    // UI deletion anonymizes the email, so deleteCreatorByEmail may not find
    // the row. Delete the archived shop explicitly, then remove any remaining
    // user row by the captured id.
    await deleteCreatorShop(shop.id)
    await deleteCreatorByEmail(creator.email)

    const [userRow] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.id, creator.id))
      .limit(1)
    if (userRow) {
      await db.delete(schema.account).where(eq(schema.account.userId, userRow.id))
      await db.delete(schema.user).where(eq(schema.user.id, userRow.id))
    }
  })

  test.setTimeout(60_000)

  test('deleting a creator account archives the shop and hides public products', async ({
    page,
  }) => {
    // Sign in as the fresh creator.
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(creator.email)
    await page.locator('[id="password"]').fill(creator.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/^(?!.*\/signin).+$/)

    // Initiate account deletion from the settings page.
    await page.goto('/account/settings')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="confirm-email"]').fill(creator.email)
    await page.getByRole('button', { name: 'Delete account permanently' }).click()
    await page.waitForURL(/\?accountDeleted=1/)

    // The creator can no longer sign in.
    await page.goto('/signin')
    await page.waitForSelector('html[data-hydrated="true"]')
    await page.locator('[id="email"]').fill(creator.email)
    await page.locator('[id="password"]').fill(creator.password)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await page.waitForURL(/\/signin/, { timeout: 15000 })
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 })

    // The public shop page is no longer visible.
    const shopPage = await page.context().newPage()
    await shopPage.goto(`/shops/${shop.slug}`)
    await shopPage.waitForSelector('html[data-hydrated="true"]')
    await expect(shopPage.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await shopPage.close()

    // The public product page is no longer visible.
    const productPage = await page.context().newPage()
    await productPage.goto(`/shops/${shop.slug}/products/${productSlug}`)
    await productPage.waitForSelector('html[data-hydrated="true"]')
    await expect(productPage.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await productPage.close()
  })
})
