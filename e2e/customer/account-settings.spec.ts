import { expect, test } from '@playwright/test'

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Account settings', () => {
  test('exports account data and toggles email preferences', async ({ page }) => {
    await page.goto('/account/settings')
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    // Data export.
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /download my data/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/eurtisan-data-export-/)

    // Toggle every email preference and confirm each saves.
    const switches = page.getByRole('switch')
    const count = await switches.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const switchControl = switches.nth(i)
      const initiallyEnabled = (await switchControl.getAttribute('aria-checked')) === 'true'
      await switchControl.click()
      await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10000 })

      // Reload and verify persistence for this single toggle.
      await page.reload()
      await page.waitForSelector('html[data-hydrated="true"]')
      const reloadedSwitch = page.getByRole('switch').nth(i)
      await expect(reloadedSwitch).toHaveAttribute(
        'aria-checked',
        initiallyEnabled ? 'false' : 'true',
      )

      // Toggle back to the original state.
      await reloadedSwitch.click()
      await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 10000 })
    }
  })
})
