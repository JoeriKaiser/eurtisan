import type { Page } from '@playwright/test'

/** Waits until React has committed the hydrated application tree. */
export async function waitForAppHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' })
}
