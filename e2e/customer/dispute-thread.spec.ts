import { test, expect } from '@playwright/test'
import { createDeliveredOrder, createDisputeForOrder } from '../fixtures/orders'

let order: Awaited<ReturnType<typeof createDeliveredOrder>>
let disputeId: string

test.beforeAll(async () => {
  order = await createDeliveredOrder('customer')
  disputeId = await createDisputeForOrder(order)
})

test.use({ storageState: 'e2e/.auth/customer.json' })

test.describe('Dispute thread', () => {
  test('posts a message in the dispute thread', async ({ page }) => {
    await page.goto(`/disputes/${disputeId}`)
    await page.waitForSelector('html[data-hydrated="true"]')

    await expect(page.getByRole('heading', { name: /dispute/i })).toBeVisible()

    // Post a message.
    await page.locator('textarea').fill('Following up on this dispute.')
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText('Following up on this dispute.')).toBeVisible()
  })
})
