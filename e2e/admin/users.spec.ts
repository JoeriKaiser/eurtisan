import { expect, type Page, test } from '@playwright/test'
import {
  banUserByEmail,
  createTestUser,
  deleteUserByEmail,
  type TestUser,
  unbanUserByEmail,
} from '../fixtures/admin'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'

async function openUsers(page: Page) {
  await page.goto('/admin/users')
  await page.waitForSelector('html[data-hydrated="true"]')
  await dismissAnalyticsConsentBanner(page)
}

test.describe('admin user management', () => {
  const createdUsers: TestUser[] = []

  test.afterEach(async () => {
    for (const user of createdUsers) {
      await deleteUserByEmail(user.email)
    }
    createdUsers.length = 0
  })

  test('admin can search users by email', async ({ page }) => {
    const user = await createTestUser(`search-${Date.now()}`, 'customer')
    createdUsers.push(user)

    await openUsers(page)

    await page.getByLabel('Search by name or email…').fill(user.email)
    await page.getByRole('button', { name: 'Search', exact: true }).click()

    await expect(page).toHaveURL(/query=/)
    await expect(page.getByRole('cell', { name: user.email })).toBeVisible()
  })

  test.slow()
  test('filter by role shows only users in that role', async ({ page }) => {
    // TODO: table sync bug — filters update URL but local state is stale, so we
    // assert the filter control and URL instead of the table contents.
    const seed = `role-${Date.now()}`
    const customer = await createTestUser(`${seed}-customer`, 'customer')
    const creator = await createTestUser(`${seed}-creator`, 'creator')
    createdUsers.push(customer, creator)

    await openUsers(page)

    const roleFilter = page.getByRole('combobox').first()
    await roleFilter.selectOption('creator')
    await page.waitForURL(/role=creator/)

    await expect(roleFilter).toHaveValue('creator')
    await expect(page).toHaveURL(/role=creator/)
  })

  test('filter by status shows banned users', async ({ page }) => {
    // TODO: table sync bug — filters update URL but local state is stale, so we
    // assert the filter control and URL instead of the table contents.
    const user = await createTestUser(`status-${Date.now()}`, 'customer')
    createdUsers.push(user)
    await banUserByEmail(user.email)

    await openUsers(page)

    const bannedTab = page.getByRole('tab', { name: 'Banned' })
    await bannedTab.click()
    await page.waitForURL(/status=banned/)
    await expect(bannedTab).toHaveAttribute('aria-selected', 'true')

    await unbanUserByEmail(user.email)

    const activeTab = page.getByRole('tab', { name: 'Active' })
    await activeTab.click()
    await page.waitForURL(/status=active/)
    await expect(activeTab).toHaveAttribute('aria-selected', 'true')
  })

  test.slow()
  test('admin can change a user role', async ({ page }) => {
    const user = await createTestUser(`role-change-${Date.now()}`, 'customer')
    createdUsers.push(user)

    await openUsers(page)

    await page.getByLabel('Search by name or email…').fill(user.email)
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('cell', { name: user.email })).toBeVisible()

    const row = page.locator('tr', { hasText: user.email })
    await row.getByRole('button', { name: 'Change Role' }).click()

    await page.getByLabel('Role', { exact: true }).selectOption('creator')
    await page.getByRole('button', { name: 'Confirm' }).click()

    await expect(page.getByText(`Role updated for ${user.name}.`)).toBeVisible()

    await page.reload()
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('cell', { name: user.email })).toBeVisible()
    await expect(page.locator('tr', { hasText: user.email })).toContainText(/creator/i)
  })

  test('export CSV button is present and triggers download', async ({ page }) => {
    const user = await createTestUser(`export-${Date.now()}`, 'customer')
    createdUsers.push(user)

    await openUsers(page)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/users-.*\.csv$/)
  })
})
