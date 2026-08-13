import { waitForAppHydration } from '../fixtures/hydration'
import { expect, test } from '@playwright/test'
import { createPaidOrder } from '../fixtures/orders'

test.describe('creator dashboard', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('displays dashboard statistics and recent activity feed', async ({ page }) => {
    // Create a paid order to guarantee at least one order activity exists
    await createPaidOrder('dashboard-test')

    // Navigate to the creator dashboard
    await page.goto('/creator')
    await waitForAppHydration(page)

    // Verify statistics cards are visible
    await expect(page.getByRole('heading', { name: 'Creator Dashboard' })).toBeVisible()
    await expect(page.getByText('Revenue this month')).toBeVisible()
    await expect(page.getByText('Pending orders')).toBeVisible()
    await expect(page.getByText('Low stock products')).toBeVisible()
    await expect(page.getByText('Total shops')).toBeVisible()

    // Verify quick actions are present
    await expect(page.getByRole('heading', { name: 'Quick actions' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Products', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Orders', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible()

    // Verify the recent activity feed renders and contains the test order we just created
    await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
    await expect(page.getByText('dashboard-test placed an order').first()).toBeVisible()
  })
})
