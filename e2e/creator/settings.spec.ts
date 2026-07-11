import { expect, test } from '@playwright/test'
import { getCreatorShop } from '../fixtures/orders'

test.describe('creator shop settings', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  let dummyPngPath: string

  test.beforeAll(async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const dummyDir = path.join(__dirname, '../fixtures')
    if (!fs.existsSync(dummyDir)) {
      fs.mkdirSync(dummyDir, { recursive: true })
    }
    dummyPngPath = path.join(dummyDir, 'dummy.png')
    const base64Png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    fs.writeFileSync(dummyPngPath, Buffer.from(base64Png, 'base64'))
  })

  test('creator can update brand settings, upload image/banner, custom policies, and configure tax/VAT settings', async ({
    page,
  }) => {
    const shop = await getCreatorShop()
    const uniqueSuffix = Date.now().toString()
    const testName = `Settings Name ${uniqueSuffix}`
    const testDesc = `This is a test description of the shop settings update ${uniqueSuffix}`

    await page.goto(`/creator/shop?shopId=${shop.id}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // 1. Edit brand details
    await page.fill('#shop-name', testName)
    await page.fill('#shop-description', testDesc)

    // 2. Upload brand image
    await page.setInputFiles('input[id="shop-image-upload"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /Remove image/i }).first()).toBeVisible({
      timeout: 15000,
    })

    // 3. Upload banner image
    await page.setInputFiles('input[id="shop-banner-image-upload"]', dummyPngPath)
    await expect(page.getByRole('button', { name: /Remove image/i }).last()).toBeVisible({
      timeout: 15000,
    })

    // 4. Update returns policy to Accepted within 30 days
    await page.getByRole('button', { name: 'Accepted within 30 days' }).first().click()

    // 5. Update Tax & VAT settings
    const vatSwitch = page.locator('#is-vat-registered')
    const isVatChecked = await vatSwitch.getAttribute('aria-checked')
    if (isVatChecked !== 'true') {
      await vatSwitch.click()
    }
    await page.fill('#vat-id', 'DE811234567')

    // 6. Save changes
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Shop settings saved successfully.')).toBeVisible({
      timeout: 15000,
    })

    // Verify on public shop page that it updated
    await page.goto(`/shops/${shop.slug}`)
    await page.waitForSelector('html[data-hydrated="true"]')
    await expect(page.getByRole('heading', { name: testName })).toBeVisible()

    // 7. Verify DAC7 Tax report page loads
    await page.goto(`/studio/${shop.id}/settings/tax`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // Verify DAC7 Tax Report page contents are rendered
    await expect(page.getByRole('heading', { name: /Tax & VAT Reporting/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /DAC7 Status/i })).toBeVisible()
  })

  test('creator can view DAC7 tax report page', async ({ page }) => {
    const shop = await getCreatorShop()
    await page.goto(`/studio/${shop.id}/settings/tax`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // Verify DAC7 Tax Report page contents are rendered
    await expect(page.getByRole('heading', { name: /Tax & VAT Reporting/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /DAC7 Status/i })).toBeVisible()
  })
})
