import { test, expect } from '@playwright/test'
import { createDeliveredOrder } from './fixtures/orders'
import { E2E_CUSTOMER } from './fixtures/auth'

let order: Awaited<ReturnType<typeof createDeliveredOrder>>

test.beforeAll(async () => {
  order = await createDeliveredOrder('customer')
})

test.describe('Buyer opens a dispute', () => {
  test.use({ storageState: 'e2e/.auth/customer.json' })

  test('opens a dispute from the order detail page', async ({ page }) => {
    await page.goto(`/orders/${order.platformOrderId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    const openDisputeButton = page.getByRole('button', { name: /open dispute/i })
    await expect(openDisputeButton).toBeVisible()
    await openDisputeButton.click()

    const dialog = page.getByRole('dialog').filter({ hasText: /Open a dispute/i })
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/description/i).fill('The item never arrived.')
    await dialog.getByRole('button', { name: /submit dispute/i }).click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/disputed/i).first()).toBeVisible()
  })
})

test.describe('Admin resolves a dispute', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('resolves the dispute as closed with no refund', async ({ page }) => {
    await page.goto('/admin/disputes')
    await page.waitForSelector('html[data-hydrated="true"]')

    // Find the dispute row for our buyer.
    const row = page.locator('tr').filter({ hasText: E2E_CUSTOMER.displayName }).first()
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.getByRole('link', { name: /view/i }).click()

    await page.waitForURL(/\/admin\/disputes\/[^/]+/)
    await expect(page.getByRole('heading', { name: /dispute/i })).toBeVisible()

    // Choose "Close (no action)" and submit.
    await page.getByLabel(/resolution/i).selectOption('close')
    await page.getByRole('button', { name: /submit resolution/i }).click()

    await expect(page.getByText(/resolved/i).first()).toBeVisible({ timeout: 15000 })
  })
})
