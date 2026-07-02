import { test, expect } from '@playwright/test'

test.describe('Legal pages', () => {
  for (const [path, heading] of [
    ['/about', /marketplace for european artisans/i],
    ['/privacy', /privacy policy/i],
    ['/terms', /terms of service/i],
    ['/cookies', /cookie policy/i],
  ] as const) {
    test(`${path} renders`, async ({ page }) => {
      await page.goto(path)
      await page.waitForSelector('html[data-hydrated="true"]')
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
    })
  }
})
