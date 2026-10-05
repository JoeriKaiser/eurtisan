import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { createPaidOrder } from '../fixtures/orders'

test.describe('creator dashboard', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('displays shop dashboard statistics and navigation', async ({ page }) => {
    await createPaidOrder('dashboard-test')

    await page.goto('/studio')
    await waitForAppHydration(page)

    await expect(page.getByRole('heading', { name: 'Shop Dashboard' })).toBeVisible()
    await expect(page.getByText('Pending orders')).toBeVisible()
    await expect(page.getByText('Low stock')).toBeVisible()
    await expect(page.getByText('Net revenue this month')).toBeVisible()
    await expect(page.getByText('Active products')).toBeVisible()

    await expect(page.getByRole('link', { name: /products/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /orders/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /settings/i })).toBeVisible()
  })
})
