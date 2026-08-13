import { waitForAppHydration } from '../fixtures/hydration'
import { type BrowserContext, expect, test } from '@playwright/test'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import {
  createCreatorShop,
  createVerifiedCreator,
  deleteCreatorByEmail,
  markCreatorDeleted,
} from '../fixtures/creators'
import { createVerifiedCustomer, deleteCustomerByEmail } from '../fixtures/customers'
import { getCreatorShop } from '../fixtures/orders'

const baseURL = process.env.BASE_URL || 'http://localhost:3000'

async function signInAndApplyCookies(context: BrowserContext, email: string, password: string) {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(response.ok).toBeTruthy()

  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('No set-cookie header returned from sign-in')
  const sessionCookie = setCookie.split(';')[0]
  const eqIdx = sessionCookie.indexOf('=')

  const cookieName = sessionCookie.slice(0, eqIdx)

  const cookieValue = sessionCookie.slice(eqIdx + 1)

  await context.addCookies([
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

test.describe('creator access control', () => {
  const createdCreators: Array<{ email: string }> = []
  let customerEmail: string | null = null

  test.afterAll(async () => {
    for (const { email } of createdCreators) {
      await deleteCreatorByEmail(email)
    }
    if (customerEmail) {
      await deleteCustomerByEmail(customerEmail)
    }
  })

  test('guest is redirected to /signin when navigating to /creator', async ({ page }) => {
    await page.goto('/creator')
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page).toHaveURL(/\/signin/)
  })

  test('customer is redirected to /forbidden when navigating to /creator', async ({
    page,
    context,
  }) => {
    const customer = await createVerifiedCustomer(`access-control-customer-${Date.now()}`)
    customerEmail = customer.email

    await signInAndApplyCookies(context, customer.email, customer.password)

    await page.goto('/creator')
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page).toHaveURL(/\/forbidden/)
  })

  test('non-owner creator is blocked from another creators studio', async ({ page, context }) => {
    const seed = `non-owner-${Date.now()}`
    const intruder = await createVerifiedCreator(seed)
    createdCreators.push({ email: intruder.email })

    // Give the intruder an approved shop so they are a fully-fledged creator.
    await createCreatorShop(intruder, seed)

    await signInAndApplyCookies(context, intruder.email, intruder.password)

    const seededShop = await getCreatorShop()

    await page.goto(`/studio/${seededShop.id}/orders`)
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page).toHaveURL(/\/forbidden|\/signin/)
  })

  test('deleted creator is blocked from /creator', async ({ page, context }) => {
    const seed = `deleted-${Date.now()}`
    const creator = await createVerifiedCreator(seed)
    createdCreators.push({ email: creator.email })

    // Sign in before marking deleted to obtain a valid session cookie.
    await signInAndApplyCookies(context, creator.email, creator.password)

    await markCreatorDeleted(creator.email)

    await page.goto('/creator')
    await waitForAppHydration(page)

    const url = page.url()
    const bodyText = await page.locator('body').textContent()
    const normalizedBody = bodyText?.toLowerCase() ?? ''

    // A deleted account is either redirected to sign-in or shown a blocked/error page.
    const isBlocked =
      url.includes('/signin') ||
      url.includes('/forbidden') ||
      normalizedBody.includes('deactivated') ||
      normalizedBody.includes('something went wrong') ||
      normalizedBody.includes('access denied') ||
      normalizedBody.includes('forbidden')
    expect(isBlocked).toBeTruthy()
  })
})
