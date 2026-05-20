import { test, expect } from '@playwright/test'

test.describe('shop creation onboarding', () => {
  test('creator can start a new shop and progress through onboarding', async ({ page }) => {
    // 1. Navigate to Seller Hub and wait for hydration
    await page.goto('/sell')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    // 2. Start a new shop — bypass the confirmation dialog (seeded creator already has 6 shops)
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByRole('button', { name: 'Open a New Shop' }).click()

    // 3. Wait for redirect to onboarding step 1 (identity)
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/identity/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /start with the basics/i })).toBeVisible()

    // 4. Fill out step 1: Identity
    await page.fill('#shop-name', 'Playwright Test Shop')
    // Slug should auto-populate from name; wait for it
    await expect(page.locator('#shop-slug')).not.toHaveValue('')
    await page.fill('#shop-tagline', 'Handcrafted goods for E2E testing')
    await page.selectOption('#shop-category', 'art_collectibles')
    await page.getByRole('button', { name: 'Handmade by me' }).click()

    // 5. Continue to step 2: Story
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/story/)
    await expect(page.getByRole('heading', { name: /tell your story/i })).toBeVisible()

    // 6. Fill out step 2: Story
    await page.fill(
      '#shop-description',
      'We create beautiful handcrafted ceramics using traditional European techniques.',
    )
    await page.fill('#shop-tags', 'pottery')
    await page.getByRole('button', { name: 'Add' }).first().click()
    await expect(page.getByText('pottery')).toBeVisible()

    await page.fill('#shop-languages', 'English')
    await page.getByRole('button', { name: 'Add' }).nth(1).click()
    await expect(page.getByText('English')).toBeVisible()

    // 7. Continue to step 3: Visuals
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.waitForURL(/\/sell\/onboarding\/[^/]+\/visuals/)
    await expect(page.getByRole('heading', { name: /visual identity/i })).toBeVisible()

    // 8. Save & Exit — verify we land back on Seller Hub
    await page.getByRole('button', { name: 'Save & Exit' }).click()
    await page.waitForURL('/sell')
    await expect(page.getByRole('heading', { name: 'Seller Hub' })).toBeVisible()

    // 9. Verify the new draft shop appears in the list
    await expect(page.getByRole('heading', { name: 'Playwright Test Shop' }).first()).toBeVisible()
    // Scope 'Draft' to the first Playwright Test Shop card
    const testShopCard = page.locator('.grid > div').filter({ hasText: 'Playwright Test Shop' }).first()
    await expect(testShopCard.getByText('Draft')).toBeVisible()
  })
})
