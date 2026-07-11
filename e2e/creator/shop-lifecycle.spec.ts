import { expect, type Page, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import {
  createCreatorShop,
  createVerifiedCreator,
  deleteCreatorByEmail,
  deleteCreatorShop,
  type TestCreator,
} from '../fixtures/creators'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

async function signInAsCreator(page: Page, creator: TestCreator): Promise<void> {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creator.email, password: creator.password }),
  })
  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from sign-in')
  const sessionCookie = setCookie.split(';')[0]
  const eqIdx = sessionCookie.indexOf('=')

  const cookieName = sessionCookie.slice(0, eqIdx)

  const cookieValue = sessionCookie.slice(eqIdx + 1)

  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 3600 * 24,
    },
  ])
}

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('creator shop lifecycle', () => {
  let creator: TestCreator
  let shop: { id: string; slug: string; name: string }
  let seed: string

  test.beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

    seed = `shop-lifecycle-${Date.now()}`
    creator = await createVerifiedCreator(seed)
    shop = await createCreatorShop(creator, seed)

    // The fixture creates an approved shop; lifecycle actions require active.
    await db.update(schema.shop).set({ status: 'active' }).where(eq(schema.shop.id, shop.id))
  })

  test.afterAll(async () => {
    await deleteCreatorShop(shop.id)
    await deleteCreatorByEmail(creator.email)
  })

  async function goToShopSettings(page: Page): Promise<void> {
    await page.goto(`/creator/shop?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await dismissAnalyticsConsentBanner(page)
  }

  async function getShopStatus(): Promise<string> {
    const [row] = await db
      .select({ status: schema.shop.status })
      .from(schema.shop)
      .where(eq(schema.shop.id, shop.id))
      .limit(1)
    return row?.status ?? ''
  }

  test('creator can pause, resume, archive, and manage shop deletion', async ({ page }) => {
    await signInAsCreator(page, creator)
    await goToShopSettings(page)

    // Pause the shop.
    await page.getByRole('button', { name: 'Pause shop' }).click()
    await expect(page.getByRole('button', { name: 'Resume shop' })).toBeVisible({
      timeout: 15000,
    })
    expect(await getShopStatus()).toBe('paused')

    // Resume the shop.
    await page.getByRole('button', { name: 'Resume shop' }).click()
    await expect(page.getByRole('button', { name: 'Pause shop' })).toBeVisible({
      timeout: 15000,
    })
    expect(await getShopStatus()).toBe('active')

    // Archive the shop.
    await page.getByRole('button', { name: 'Archive shop' }).click()
    await expect(page.getByRole('button', { name: 'Request deletion' })).toBeVisible({
      timeout: 15000,
    })
    expect(await getShopStatus()).toBe('archived')

    // Request deletion for the archived shop.
    await page.getByRole('button', { name: 'Request deletion' }).click()
    await expect(page.getByText(/scheduled for deletion/i)).toBeVisible({
      timeout: 15000,
    })

    const [scheduledRow] = await db
      .select({ scheduledDeleteAt: schema.shop.scheduledDeleteAt })
      .from(schema.shop)
      .where(eq(schema.shop.id, shop.id))
      .limit(1)
    expect(scheduledRow?.scheduledDeleteAt).not.toBeNull()

    // Cancel the deletion request.
    await page.getByRole('button', { name: 'Cancel deletion' }).click()
    await expect(page.getByRole('button', { name: 'Request deletion' })).toBeVisible({
      timeout: 15000,
    })

    const [cancelledRow] = await db
      .select({ scheduledDeleteAt: schema.shop.scheduledDeleteAt })
      .from(schema.shop)
      .where(eq(schema.shop.id, shop.id))
      .limit(1)
    expect(cancelledRow?.scheduledDeleteAt).toBeNull()

    // Archived shops are no longer visible on the creator dashboard.
    await page.evaluate(() => {
      window.localStorage.setItem('eurtisan_analytics_consent', 'denied')
    })
    await page.goto('/creator')
    await page.waitForURL('/creator')
    await expect(page.getByText("You don't have any shops yet.")).toBeVisible({
      timeout: 15000,
    })
  })
})
