import { waitForAppHydration } from '../fixtures/hydration'
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import type { TestUser } from '../fixtures/admin'
import { createTestUser, deleteUserByEmail } from '../fixtures/admin'
import { E2E_ADMIN } from '../fixtures/auth'

const SEED = Date.now().toString()

test.describe('admin audit log', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 1440, height: 900 } })

  let testUser: TestUser
  let adminId = ''

  test.beforeAll(async () => {
    const [user, adminRows] = await Promise.all([
      createTestUser(SEED, 'customer'),
      db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, E2E_ADMIN.email)),
    ])

    testUser = user
    adminId = adminRows[0]?.id ?? ''
    if (!adminId) throw new Error('E2E admin user not found')
  })

  test.afterAll(async () => {
    await deleteUserByEmail(testUser.email)
  })

  test('admin audit log renders', async ({ page }) => {
    await goto(page, '/admin/audit-log')

    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()
    await expect(page.locator('div.rounded-xl.border.border-border-default').first()).toBeVisible()
  })

  test('audit log entries are filterable by action', async ({ page }) => {
    await banUserViaUI(page, testUser)

    await goto(page, '/admin/audit-log')

    const actionSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value="user.ban"]') })

    await actionSelect.selectOption('user.ban')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.waitForURL((url) => url.searchParams.get('action') === 'user.ban')

    await expect(actionSelect).toHaveValue('user.ban')
    await expectAuditEntry(page, testUser)
  })

  test('audit log entries are filterable by actor', async ({ page }) => {
    await goto(page, `/admin/audit-log?actorId=${adminId}`)

    await expect(page.getByLabel('Actor')).toHaveValue(adminId)
    await expectAuditEntry(page, testUser)
  })

  test('audit log entries are filterable by resource type', async ({ page }) => {
    await goto(page, '/admin/audit-log?resourceType=user')

    const resourceSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value="user"]') })

    await expect(resourceSelect).toHaveValue('user')
    await expectAuditEntry(page, testUser)
  })

  test('clearing filters restores full list', async ({ page }) => {
    await goto(page, '/admin/audit-log?action=user.ban')

    const actionSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value="user.ban"]') })
    const resourceSelect = page
      .locator('select')
      .filter({ has: page.locator('option[value="user"]') })
    const actorInput = page.getByLabel('Actor')

    await expect(actionSelect).toHaveValue('user.ban')

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await page.waitForURL((url) => url.searchParams.get('action') !== 'user.ban')

    await expect(actionSelect).toHaveValue('')
    await expect(resourceSelect).toHaveValue('')
    await expect(actorInput).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Clear filters' })).toBeHidden()
    await expectAuditEntry(page, testUser)
  })
})

async function goto(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForAppHydration(page)
}

async function banUserViaUI(page: Page, target: TestUser): Promise<void> {
  await goto(page, '/admin/users')

  const searchInput = page.getByLabel(/Search by name or email/)
  await searchInput.fill(target.email)
  await searchInput.press('Enter')
  await page.waitForURL((url) => url.searchParams.get('query') === target.email)

  const row = page.locator('tbody tr').filter({ hasText: target.email }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Ban' }).click()
  await expect(page.getByRole('heading', { name: `Ban ${target.name}?` })).toBeVisible()

  await page.getByRole('button', { name: 'Ban User' }).click()
  await expect(row.getByText('Banned')).toBeVisible()
  await expect(row.getByRole('button', { name: 'Unban' })).toBeVisible()
}

async function expectAuditEntry(page: Page, target: TestUser): Promise<void> {
  const entry = page
    .locator('div.rounded-xl.border.border-border-default')
    .filter({ hasText: 'user.ban' })
    .filter({ hasText: target.id.slice(0, 8) })
    .first()

  await expect(entry).toBeVisible()
}
