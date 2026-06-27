import type { Page } from '@playwright/test'

const STORAGE_KEY = 'eurtisan_analytics_consent'

/**
 * Dismiss the analytics consent banner by storing a denial in localStorage.
 * Call after navigating to any page where the banner may appear.
 */
export async function dismissAnalyticsConsentBanner(page: Page): Promise<void> {
  await page.evaluate((key) => {
    try {
      window.localStorage.setItem(key, 'denied')
    } catch {
      // Ignore localStorage write failures.
    }
  }, STORAGE_KEY)
  // Force a reload so the banner reads the stored consent and hides itself.
  await page.reload()
  await page.waitForSelector('html[data-hydrated="true"]')
}
