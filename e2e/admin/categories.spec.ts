import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { eq, like } from 'drizzle-orm'
import { categories } from '../../src/db/schema'
import { db } from '../db'
import { createTestCategory, deleteTestCategory, type TestCategory } from '../fixtures/admin'

const E2E_CATEGORY_NAME_PREFIX = 'E2E Admin Category'
const E2E_CATEGORY_SLUG_PREFIX = 'e2e-admin-category'

const seededCategories: TestCategory[] = []

async function cleanupUiCreatedCategories() {
  await db.delete(categories).where(like(categories.slug, `${E2E_CATEGORY_SLUG_PREFIX}%`))
}

test.afterAll(async () => {
  for (const category of seededCategories) {
    await deleteTestCategory(category.id)
  }
  await cleanupUiCreatedCategories()
})

test.describe('admin category management', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('admin can create a new category', async ({ page }) => {
    const seed = Date.now().toString()
    const name = `${E2E_CATEGORY_NAME_PREFIX} ${seed}`
    const slug = `${E2E_CATEGORY_SLUG_PREFIX}-${seed}`
    const description = `E2E category created via admin UI (${seed})`

    await page.goto('/admin/categories')
    await waitForAppHydration(page)

    await page.getByRole('button', { name: 'New Category' }).first().click()
    await page.locator('#cat-name').fill(name)
    await page.locator('#cat-slug').fill(slug)
    await page.locator('#cat-desc').fill(description)
    await page.getByRole('button', { name: 'New Category' }).last().click()

    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible({ timeout: 20000 })
  })

  test('admin can edit a category', async ({ page }) => {
    const seed = Date.now().toString()
    const category = await createTestCategory(seed)
    seededCategories.push(category)

    const updatedName = `${category.name} Updated`

    await page.goto('/admin/categories')
    await waitForAppHydration(page)

    const row = page.getByRole('row', { name: new RegExp(category.name, 'i') })
    await row.getByRole('button', { name: new RegExp(`Edit ${category.name}`) }).click()

    await page.locator('#cat-name').fill(updatedName)
    await page.locator('#cat-desc').fill(`${category.description} (edited)`)
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByRole('cell', { name: updatedName, exact: true })).toBeVisible({
      timeout: 20000,
    })
  })

  test('admin can delete a category', async ({ page }) => {
    const seed = Date.now().toString()
    const category = await createTestCategory(seed)
    seededCategories.push(category)

    await page.goto('/admin/categories')
    await waitForAppHydration(page)

    const row = page.getByRole('row', { name: new RegExp(category.name, 'i') })
    await row.getByRole('button', { name: new RegExp(`Delete ${category.name}`) }).click()

    await page.getByRole('button', { name: /^Delete$/ }).click()

    await expect(page.getByRole('cell', { name: category.name, exact: true })).toHaveCount(0, {
      timeout: 20000,
    })
  })

  test('admin can move a category up or down', async ({ page }) => {
    const parentSeed = `${Date.now()}-parent`
    const seedA = `${Date.now()}-alpha`
    const seedB = `${Date.now()}-beta`
    const parent = await createTestCategory(parentSeed)
    const categoryA = await createTestCategory(seedA, parent.id)
    const categoryB = await createTestCategory(seedB, parent.id)
    seededCategories.push(parent, categoryA, categoryB)

    // Give the siblings distinct sort orders so swapping produces a visible order change.
    await db.update(categories).set({ sortOrder: 0 }).where(eq(categories.id, categoryA.id))
    await db.update(categories).set({ sortOrder: 1 }).where(eq(categories.id, categoryB.id))

    await page.goto('/admin/categories')
    await waitForAppHydration(page)

    await expect(page.getByRole('cell', { name: categoryA.name, exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('cell', { name: categoryB.name, exact: true })).toBeVisible({
      timeout: 10000,
    })

    const rowNamesBefore = await page.locator('tbody tr td:first-child span').allTextContents()

    const row = page.getByRole('row', { name: new RegExp(categoryA.name, 'i') })
    await row.getByRole('button', { name: new RegExp(`Move ${categoryA.name} down`) }).click()

    await expect
      .poll(async () => page.locator('tbody tr td:first-child span').allTextContents())
      .not.toEqual(rowNamesBefore)
  })
})
