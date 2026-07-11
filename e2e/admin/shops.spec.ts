import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import type { shopStatusEnum } from '../../src/db/schema'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import {
  createCreatorShop,
  createVerifiedCreator,
  deleteCreatorByEmail,
} from '../fixtures/creators'

test.describe('admin shop moderation', () => {
  const createdCreators: string[] = []

  test.afterAll(async () => {
    for (const email of createdCreators) {
      await deleteCreatorByEmail(email)
    }
  })

  async function seedCreatorWithShop(seed: string) {
    const creator = await createVerifiedCreator(seed)
    createdCreators.push(creator.email)
    const shop = await createCreatorShop(creator, seed)
    return { creator, shop }
  }

  async function setShopStatus(shopId: string, status: (typeof shopStatusEnum.enumValues)[number]) {
    await db.update(schema.shop).set({ status }).where(eq(schema.shop.id, shopId))
  }

  test('admin shop list renders', async ({ page }) => {
    const seed = `list-${Date.now()}`
    const { shop } = await seedCreatorWithShop(seed)

    await page.goto('/admin/shops')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: 'Shop Moderation' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Shop Name' })).toBeVisible()

    const row = page.locator('table tbody tr').filter({ hasText: shop.name })
    await expect(row).toBeVisible()
  })

  test('admin can filter shops by status', async ({ page }) => {
    const seed = `filter-${Date.now()}`
    const { shop } = await seedCreatorWithShop(seed)

    await page.goto('/admin/shops')
    await page.waitForSelector('html[data-hydrated="true"]')

    const filterTabs = page.getByRole('tablist', { name: 'Filter shops by status' })
    const row = page.locator('table tbody tr').filter({ hasText: shop.name })
    await expect(row).toBeVisible()

    await filterTabs.getByRole('tab', { name: 'Active' }).click()
    await expect(page).toHaveURL(/[?&]filter=active/)
    await expect(row).toBeVisible()

    await filterTabs.getByRole('tab', { name: 'Suspended' }).click()
    await expect(page).toHaveURL(/[?&]filter=suspended/)
    await expect(row).not.toBeVisible()
  })

  test('admin can approve a shop application', async ({ page }) => {
    const seed = `approve-${Date.now()}`
    const { shop } = await seedCreatorWithShop(seed)
    await setShopStatus(shop.id, 'pending_review')

    await page.goto('/admin/shops')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('tab', { name: 'Onboarding Applications' }).click()
    await expect(page).toHaveURL(/[?&]view=applications/)

    const row = page.locator('table tbody tr').filter({ hasText: shop.name })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Review Application' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Review Decision')).toBeVisible()
    await dialog.getByRole('button', { name: 'Approve Shop' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(row.getByText('Approved', { exact: true })).toBeVisible()
  })

  test('admin can request changes on a shop application', async ({ page }) => {
    const seed = `changes-${Date.now()}`
    const { shop } = await seedCreatorWithShop(seed)
    await setShopStatus(shop.id, 'pending_review')

    await page.goto('/admin/shops')
    await page.waitForSelector('html[data-hydrated="true"]')

    await page.getByRole('tab', { name: 'Onboarding Applications' }).click()
    await expect(page).toHaveURL(/[?&]view=applications/)

    const row = page.locator('table tbody tr').filter({ hasText: shop.name })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Review Application' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Review Decision')).toBeVisible()

    await dialog.locator('#review-note').fill('Please update your shop policies and add a logo.')
    await dialog.getByRole('button', { name: 'Request Changes' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(row.getByText('Changes Requested', { exact: true })).toBeVisible()
  })

  test('admin can suspend and unsuspend a shop', async ({ page }) => {
    const seed = `suspend-${Date.now()}`
    const { shop } = await seedCreatorWithShop(seed)

    await page.goto('/admin/shops')
    await page.waitForSelector('html[data-hydrated="true"]')

    const row = page.locator('table tbody tr').filter({ hasText: shop.name })
    await expect(row).toBeVisible()

    await row.getByRole('button', { name: `Suspend ${shop.name}` }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.locator('#moderation-note').fill('Policy violation during review')
    await dialog.getByRole('button', { name: 'Suspend Shop' }).click()

    await expect(dialog).not.toBeVisible()
    await expect(row.getByText('Suspended', { exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: `Unsuspend ${shop.name}` })).toBeVisible()

    await row.getByRole('button', { name: `Unsuspend ${shop.name}` }).click()
    await expect(row.getByText('Active', { exact: true })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Suspend' })).toBeVisible()
  })
})
