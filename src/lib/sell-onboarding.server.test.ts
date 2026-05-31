import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import {
  orderItem,
  payout,
  platformOrder,
  product,
  shop,
  shopOrder,
  shopSocials,
  user,
} from '#/db/schema'
import { createShopDraftInternal, saveOnboardingStepInternal } from './sell-onboarding.server'

beforeEach(async () => {
  await db.delete(shopSocials)
  await db.delete(payout)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(product)
  await db.delete(shop)
  await db.delete(user)
})

async function seedUser(overrides?: Partial<typeof user.$inferInsert>) {
  const [u] = await db
    .insert(user)
    .values({
      id: crypto.randomUUID(),
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
  return u
}

describe('createShopDraftInternal', () => {
  it('creates a draft shop', async () => {
    const u = await seedUser()
    const result = await createShopDraftInternal(u)
    expect(result.id).toBeDefined()

    const rows = await db.select().from(shop).where(eq(shop.ownerId, u.id))
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('draft')
  })

  it('rejects when user already has 10 draft shops', async () => {
    const u = await seedUser()
    for (let i = 0; i < 10; i++) {
      await createShopDraftInternal(u)
    }

    await expect(createShopDraftInternal(u)).rejects.toThrow()

    try {
      await createShopDraftInternal(u)
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      expect((err as Response).status).toBe(429)
      const body = await (err as Response).json()
      expect(body.error).toBe('Too Many Drafts')
      expect(body.message).toContain('10')
    }

    const rows = await db.select().from(shop).where(eq(shop.ownerId, u.id))
    expect(rows.length).toBe(10)
  })
})

describe('saveOnboardingStepInternal', () => {
  it('sanitizes HTML in description', async () => {
    const u = await seedUser()
    const draft = await createShopDraftInternal(u)

    await saveOnboardingStepInternal(u.id, u.role, {
      draftId: draft.id,
      step: 2,
      data: {
        description: '<script>alert("xss")</script><p>Hello</p>',
      },
    })

    const rows = await db.select().from(shop).where(eq(shop.id, draft.id))
    expect(rows[0].description).toBe('<p>Hello</p>')
  })

  it('stores null for empty description', async () => {
    const u = await seedUser()
    const draft = await createShopDraftInternal(u)

    await saveOnboardingStepInternal(u.id, u.role, {
      draftId: draft.id,
      step: 2,
      data: {
        description: '',
      },
    })

    const rows = await db.select().from(shop).where(eq(shop.id, draft.id))
    expect(rows[0].description).toBeNull()
  })
})
