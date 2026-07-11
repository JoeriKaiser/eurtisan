import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { createPaidOrder, getCreatorShop } from '../fixtures/orders'

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

test.describe('creator customers CRM', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  test('creator can view customers directory, inspect customer detail, add tag, and add note', async ({
    page,
  }) => {
    const shop = await getCreatorShop()
    const customerSeed = `crm-${Date.now()}`
    await createPaidOrder(customerSeed)

    const customerEmail = `e2e-${customerSeed}@eurtisan.local`
    const customerName = `E2E Customer ${customerSeed}`
    const customerHash = hashEmail(customerEmail)

    // 1. Navigate to studio customer list
    await page.goto(`/studio/${shop.id}/customers`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // Verify list contains our new customer
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible()
    const row = page.locator('tr').filter({ hasText: customerName })
    await expect(row).toBeVisible()

    // 2. Click "View" link to navigate to details
    await row.getByRole('link', { name: 'View' }).click()
    await page.waitForURL(`/studio/${shop.id}/customers/${customerHash}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    // Verify detail page has loaded
    await expect(page.getByRole('heading', { name: customerName })).toBeVisible()
    await expect(page.getByText(customerEmail)).toBeVisible()

    // 3. Add a tag
    await page.getByPlaceholder('Add a tag...').fill('premium-buyer')
    await page.getByRole('button', { name: 'Add tag' }).click()
    await expect(page.getByText('premium-buyer')).toBeVisible()

    // 4. Add a note
    const testNote = 'Customer requested special gift wrapping.'
    await page.getByPlaceholder('Write a note...').fill(testNote)
    await page.getByRole('button', { name: 'Add note' }).click()
    await expect(page.getByText(testNote)).toBeVisible()
  })
})
