import { waitForAppHydration } from '../fixtures/hydration'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { and, eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import { db } from '../db'
import { dismissAnalyticsConsentBanner } from '../fixtures/consent'
import { deleteCustomerByEmail } from '../fixtures/customers'
import type { TestOrder } from '../fixtures/orders'
import { createPaidOrder, deleteOrder, getCreatorShop } from '../fixtures/orders'

test.describe('creator customer CRM full', () => {
  test.use({ storageState: 'e2e/.auth/creator.json' })

  const customerSeed = `crm-full-${Date.now()}`
  let shopId = ''
  let customerHash = ''
  let customerEmail = ''
  let customerName = ''
  let testOrder: TestOrder | null = null

  test.beforeAll(async () => {
    const shop = await getCreatorShop()
    shopId = shop.id
    testOrder = await createPaidOrder(customerSeed)

    customerEmail = `e2e-${customerSeed}@eurtisan.local`
    customerName = `E2E Customer ${customerSeed}`
    customerHash = createHash('sha256').update(customerEmail.toLowerCase().trim()).digest('hex')
  })

  test.afterAll(async () => {
    if (testOrder) {
      await deleteOrder(testOrder)
    }

    if (shopId && customerHash) {
      await db
        .delete(schema.customerNote)
        .where(
          and(
            eq(schema.customerNote.shopId, shopId),
            eq(schema.customerNote.customerEmailHash, customerHash),
          ),
        )
      await db
        .delete(schema.customerTag)
        .where(
          and(
            eq(schema.customerTag.shopId, shopId),
            eq(schema.customerTag.customerEmailHash, customerHash),
          ),
        )
    }

    if (customerEmail) {
      await deleteCustomerByEmail(customerEmail)
    }
  })

  test('creator can search customers, manage notes and tags, and export data', async ({ page }) => {
    // 1. Navigate to the customer directory.
    await page.goto(`/studio/${shopId}/customers`)
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible()
    const customerRow = page.locator('tr').filter({ hasText: customerName })
    await expect(customerRow).toBeVisible()

    // 2. Search by customer name.
    await page.getByPlaceholder('Search by name or email...').fill(customerName)
    await page.waitForURL(new RegExp(`/studio/${shopId}/customers\\?.*search=`))
    await expect(page.locator('tr').filter({ hasText: customerName })).toBeVisible()
    await expect(page.getByText('No matching customers')).not.toBeVisible()

    // 3. Clear the search and search by email.
    await page.getByPlaceholder('Search by name or email...').clear()
    await page.waitForURL(new RegExp(`/studio/${shopId}/customers\\?`))
    await page.getByPlaceholder('Search by name or email...').fill(customerEmail)
    await page.waitForURL(new RegExp(`/studio/${shopId}/customers\\?.*search=`))
    await expect(page.locator('tr').filter({ hasText: customerName })).toBeVisible()

    // 4. Open the customer detail page.
    await page
      .locator('tr')
      .filter({ hasText: customerName })
      .getByRole('link', { name: 'View' })
      .click()
    await page.waitForURL(`/studio/${shopId}/customers/${customerHash}`)
    await waitForAppHydration(page)
    await dismissAnalyticsConsentBanner(page)

    await expect(page.getByRole('heading', { name: customerName })).toBeVisible()
    await expect(page.getByText(customerEmail)).toBeVisible()

    // 5. Add a note.
    const initialNote = 'CRM test note – initial content.'
    await page.getByPlaceholder('Write a note...').fill(initialNote)
    await page.getByRole('button', { name: 'Add note' }).click()
    await expect(page.getByText(initialNote)).toBeVisible()

    // 6. Edit the note and assert the updated text is visible.
    const updatedNote = 'CRM test note – updated content.'
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('textbox').filter({ hasText: initialNote }).fill(updatedNote)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Note updated.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(page.getByText(updatedNote)).toBeVisible()
    await expect(page.getByText(initialNote)).not.toBeVisible()

    // 7. Delete the note and assert it is removed.
    page.once('dialog', async (dialog) => await dialog.accept())
    await page
      .getByRole('listitem')
      .filter({ hasText: updatedNote })
      .getByRole('button')
      .filter({ hasNotText: 'Edit' })
      .click()
    await expect(page.getByText(updatedNote)).not.toBeVisible()

    // 8. Add a tag.
    const tag = 'crm-full-tag'
    await page.getByPlaceholder('Add a tag...').fill(tag)
    await page.getByRole('button', { name: 'Add tag' }).click()
    await expect(page.getByText(tag)).toBeVisible()

    // 9. Remove the tag and assert it is removed.
    await page.getByRole('button', { name: `Remove tag ${tag}` }).click()
    await expect(page.getByText(tag)).not.toBeVisible()

    // 10. Export the customer data and assert the action completes.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export data' }).click(),
    ])
    await expect(page.getByText('Customer data exported.')).toBeVisible()
    expect(download.suggestedFilename()).toMatch(/customer-export-.*\.json$/)
  })
})
