import { expect, test } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Notifications', () => {
  test('renders the notifications list and supports mark-all-read', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible()

    // Either notifications exist or empty state is shown.
    const notificationList = page.getByRole('list', { name: /notifications/i })
    const firstItem = notificationList.getByRole('listitem').first()
    const emptyState = page.getByText(/no notifications/i)
    await expect(firstItem.or(emptyState)).toBeVisible()

    if (await firstItem.isVisible().catch(() => false)) {
      // The E2E seed creates unread notifications for the fixed customer account.
      const markAllReadButton = page.getByRole('button', { name: /mark all as read/i })
      await expect(markAllReadButton).toBeVisible()
      await markAllReadButton.click()

      // Unread indicator dots should disappear after marking all read.
      await expect(page.locator('span.rounded-full.bg-accent-primary')).toHaveCount(0)

      // Header badge should also clear (target the notifications badge only).
      const headerBadge = page.getByLabel(/unread notifications/i)
      await expect(headerBadge).not.toBeVisible()
    }
  })

  test('navigates via notification deep link', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForSelector('html[data-hydrated="true"]')

    const notificationList = page.getByRole('list', { name: /notifications/i })
    const firstItem = notificationList.getByRole('listitem').first()
    if (await firstItem.isVisible().catch(() => false)) {
      const firstButton = firstItem.getByRole('button').first()
      const previewText = await firstButton.locator('p').first().textContent()
      expect(previewText).toBeTruthy()

      await firstButton.click()

      // Should navigate to a deep-linked page (order, product, etc.).
      await page.waitForURL(/\/(orders|shops|account|studio|creator)\//)
    } else {
      test.skip(true, 'No seeded notifications available for deep-link test')
    }
  })
})
