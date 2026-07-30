import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import {
  createCreatorShop,
  createVerifiedCreator,
  deleteCreatorByEmail,
  deleteCreatorShop,
} from '../fixtures/creators'
import { getCreatorShop, getTestProduct } from '../fixtures/orders'

test.describe('Shop page', () => {
  test('renders shop header and product list', async ({ page }) => {
    await page.goto('/')
    await waitForAppHydration(page)

    // Click the first featured shop card inside the shops section.
    const firstShop = page.locator('section[aria-labelledby="shops-heading"] a').first()
    await expect(firstShop).toBeVisible()
    await firstShop.click()

    await page.waitForURL(/\/shops\//)
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('filters products with in-site search and clears the query', async ({ page }) => {
    const shop = await getCreatorShop()
    const product = await getTestProduct(shop.id)

    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible()

    // Use a distinctive substring from a known product name to filter results.
    const searchTerm = product.name.slice(0, Math.min(12, product.name.length))
    await page.getByRole('searchbox', { name: /search products/i }).fill(searchTerm)
    await page.getByRole('button', { name: /^search$/i }).click()

    await page.waitForURL(/[?&]search=/)
    await expect(
      page
        .getByLabel(/^Product:/)
        .filter({ hasText: searchTerm })
        .first(),
    ).toBeVisible()

    // Clear the search via direct navigation and confirm the full product grid returns.
    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    const clearedUrl = new URL(page.url())
    expect(clearedUrl.searchParams.has('search')).toBe(false)
    await expect(page.getByLabel(/^Product:/).first()).toBeVisible()
  })

  test('returns 404 for a non-existent shop', async ({ page }) => {
    await page.goto('/shops/xyznonexistent12345')
    await waitForAppHydration(page)

    await expect(page.getByText(/not found/i)).toBeVisible()
  })

  test('a fully populated shop shows every profile panel', async ({ page }) => {
    await page.goto('/shops/atelier-verrier')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Atelier Verrier' })).toBeVisible()
    await expect(page.getByText('Mouth-blown glass from the Vosges')).toBeVisible()
    await expect(page.getByText(/furnace is down for its annual reline/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /about the maker/i })).toBeVisible()
    await expect(page.getByText(/made with a production partner/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /shop policies/i })).toBeVisible()
    await expect(page.getByText(/returns accepted within 14 days/i)).toBeVisible()
    await expect(page.getByText(/statutory rights/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /find this maker/i })).toBeVisible()

    // Proves the encrypted `shippingOrigin` survives the round trip: this text
    // only renders if the ciphertext decrypted and parsed.
    await expect(page.getByText('Ships from France')).toBeVisible()

    // The rest of that column is seller PII and must never reach the page.
    const body = await page.locator('body').innerText()
    for (const secret of ['Saint-Louis', '68300', 'Rue de la Verrerie', 'FR12345678901']) {
      expect(body).not.toContain(secret)
    }
  })

  test('a shop that filled in nothing optional still reads as a finished page', async ({
    page,
  }) => {
    await page.goto('/shops/quiet-bindery')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Quiet Bindery' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /about the maker/i })).toBeVisible()

    // Absent panels must be absent, not empty shells.
    await expect(page.getByRole('heading', { name: /shop policies/i })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /find this maker/i })).toHaveCount(0)
    await expect(page.getByText(/made with a production partner/i)).toHaveCount(0)

    // The in-page nav must not offer a jump to a section that did not render.
    const inPageNav = page.locator('nav a[href^="#"]')
    await expect(inPageNav).toHaveText(['About', 'Products'])
  })

  test('puts sorting in the URL and keeps it linkable', async ({ page }) => {
    const shop = await getCreatorShop()

    await page.goto(`/shops/${shop.slug}`)
    await waitForAppHydration(page)

    const sortGroup = page.getByRole('group', { name: /sort by/i })
    await expect(sortGroup.getByRole('button', { name: /newest/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await sortGroup.getByRole('button', { name: /low to high/i }).click()
    await page.waitForURL(/[?&]sort=price_asc/)

    // Reloading the shared URL must restore the same state, which is the whole
    // point of holding it in the URL rather than in component state.
    await page.reload()
    await waitForAppHydration(page)
    await expect(sortGroup.getByRole('button', { name: /low to high/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('keeps the text query when a filter changes, and clears filters without it', async ({
    page,
  }) => {
    const shop = await getCreatorShop()
    const product = await getTestProduct(shop.id)
    const searchTerm = product.name.slice(0, Math.min(12, product.name.length))

    await page.goto(`/shops/${shop.slug}?search=${encodeURIComponent(searchTerm)}`)
    await waitForAppHydration(page)

    // `click`, not `check`: ticking the box navigates, and `check` re-queries
    // the detached element and toggles it back while retrying its assertion.
    await page.getByRole('checkbox', { name: /in stock only/i }).click()
    await page.waitForURL(/[?&]inStock=true/)
    // A filter must never silently drop the buyer's own words.
    expect(new URL(page.url()).searchParams.get('search')).toBe(searchTerm)

    await page.getByRole('button', { name: /clear filters/i }).click()
    await page.waitForURL((url) => !url.searchParams.has('inStock'))
    expect(new URL(page.url()).searchParams.get('search')).toBe(searchTerm)
  })

  test('suspending a shop 404s it, indistinguishably from one that never existed', async ({
    page,
  }) => {
    // A shop of its own rather than a curated one: this test has to mutate
    // visibility, and no other spec should be able to observe that.
    const creator = await createVerifiedCreator('suspended-shop')
    const shop = await createCreatorShop(creator, 'suspended-shop')
    await db.update(schema.shop).set({ status: 'active' }).where(eq(schema.shop.id, shop.id))

    try {
      // Renders first, so the 404 below is attributable to the suspension and
      // not to the shop having been invisible all along.
      await page.goto(`/shops/${shop.slug}`)
      await waitForAppHydration(page)
      await expect(page.getByRole('heading', { level: 1, name: shop.name })).toBeVisible()

      await db.update(schema.shop).set({ isSuspended: true }).where(eq(schema.shop.id, shop.id))

      await page.goto(`/shops/${shop.slug}`)
      await waitForAppHydration(page)
      await expect(page.getByText(/not found/i)).toBeVisible()

      // The response must not reveal that this slug belongs to a real shop, nor
      // why it is gone — a suspended shop and an unknown one look identical.
      const body = await page.locator('body').innerText()
      expect(body).not.toContain(shop.name)
      expect(body).not.toMatch(/suspend/i)
    } finally {
      await deleteCreatorShop(shop.id)
      await deleteCreatorByEmail(creator.email)
    }
  })
})
