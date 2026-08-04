import { beforeEach, describe, expect, it, vi } from 'vitest'

import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { orderItem, platformOrder, product, shop, shopOrder, shopSocials, user } from '#/db/schema'
import { decryptJsonb, encryptJsonb } from '#/lib/encryption.server'

import {
  checkSlugUniquePlatformWide,
  SlugCollisionError,
  updateShopInternal,
} from './shop-settings.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(orderItem)
  await db.delete(product)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

async function seedUser(
  overrides?: Partial<typeof user.$inferInsert>,
): Promise<typeof user.$inferSelect> {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Creator',
      email: 'creator@example.com',
      emailVerified: true,
      role: 'creator',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0] as typeof user.$inferSelect)
}

async function seedShop(
  overrides?: Partial<typeof shop.$inferInsert>,
): Promise<typeof shop.$inferSelect> {
  return db
    .insert(shop)
    .values({
      id: 'shop-1',
      name: 'Test Shop',
      slug: 'test-shop',
      ownerId: 'user-1',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0] as typeof shop.$inferSelect)
}

/* -------------------------------------------------------------------------- */
/*                       checkSlugUniquePlatformWide                          */
/* -------------------------------------------------------------------------- */

describe('checkSlugUniquePlatformWide', () => {
  it('returns true when slug is not used', async () => {
    await seedUser()
    await seedShop({ slug: 'existing-shop' })
    const isUnique = await checkSlugUniquePlatformWide('new-shop')
    expect(isUnique).toBe(true)
  })

  it('returns false when slug is already in use', async () => {
    await seedUser()
    await seedShop({ slug: 'existing-shop' })
    const isUnique = await checkSlugUniquePlatformWide('existing-shop')
    expect(isUnique).toBe(false)
  })

  it('returns true when slug matches excluded shop', async () => {
    await seedUser()
    const s = await seedShop({ id: 'my-shop', slug: 'my-slug' })
    const isUnique = await checkSlugUniquePlatformWide('my-slug', s.id)
    expect(isUnique).toBe(true)
  })

  it('returns false when slug is used by a different shop', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', slug: 'collision' })
    const isUnique = await checkSlugUniquePlatformWide('collision', 'shop-b')
    expect(isUnique).toBe(false)
  })

  it('returns true when no shops exist', async () => {
    const isUnique = await checkSlugUniquePlatformWide('anything')
    expect(isUnique).toBe(true)
  })
})

/* -------------------------------------------------------------------------- */
/*                              updateShopInternal                             */
/* -------------------------------------------------------------------------- */

describe('updateShopInternal', () => {
  it('updates the shop name', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.slug).toBe('test-shop')
  })

  it('updates the shop slug when unique', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { slug: 'new-slug' })
    expect(updated.slug).toBe('new-slug')
  })

  it('updates the shop description', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, { description: 'A new description' })
    expect(updated.description).toBe('A new description')
  })

  it('sanitizes HTML in description', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      description: '<script>alert("xss")</script>',
    })
    expect(updated.description).toBeNull()
  })

  it('throws SlugCollisionError when slug is already in use by another shop', async () => {
    await seedUser()
    await seedShop({ id: 'shop-a', slug: 'taken' })
    const s = await seedShop({ id: 'shop-b', slug: 'mine' })
    await expect(updateShopInternal(s.id, { slug: 'taken' })).rejects.toThrow(SlugCollisionError)
  })

  it('does not throw when slug is unchanged', async () => {
    await seedUser()
    const s = await seedShop({ slug: 'my-slug' })
    const updated = await updateShopInternal(s.id, { slug: 'my-slug' })
    expect(updated.slug).toBe('my-slug')
  })

  it('updates multiple fields at once', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      name: 'Renamed Shop',
      slug: 'renamed-shop',
      description: 'Updated description.',
    })
    expect(updated.name).toBe('Renamed Shop')
    expect(updated.slug).toBe('renamed-shop')
    expect(updated.description).toBe('Updated description.')
  })
  it('retains dispatch settings when updating an encrypted shipping origin address', async () => {
    await seedUser()
    const originalOrigin = {
      street: '1 Old Lane',
      city: 'Lyon',
      postalCode: '69001',
      country: 'FR',
      processingTimeDays: { min: 2, max: 4 },
      shipsInternational: true,
    }
    const updatedAddress = {
      street: '2 New Lane',
      city: 'Paris',
      postalCode: '75001',
      country: 'FR',
    }
    const s = await seedShop({ shippingOrigin: encryptJsonb(originalOrigin) })

    await updateShopInternal(s.id, { shippingOrigin: updatedAddress })

    const [persisted] = await db.select().from(shop).where(eq(shop.id, s.id))
    expect(persisted.shippingOrigin).toEqual(expect.any(String))
    expect(decryptJsonb(persisted.shippingOrigin)).toEqual({
      ...originalOrigin,
      ...updatedAddress,
    })
  })

  it('migrates a plaintext shipping origin while retaining its dispatch settings', async () => {
    await seedUser()
    const originalOrigin = {
      street: '3 Old Road',
      city: 'Nice',
      postalCode: '06000',
      country: 'FR',
      processingTimeDays: { min: 1, max: 2 },
      shipsInternational: false,
    }
    const updatedAddress = {
      street: '4 New Road',
      city: 'Marseille',
      postalCode: '13001',
      country: 'FR',
    }
    const s = await seedShop({ shippingOrigin: originalOrigin })

    await updateShopInternal(s.id, { shippingOrigin: updatedAddress })

    const [persisted] = await db.select().from(shop).where(eq(shop.id, s.id))
    expect(persisted.shippingOrigin).toEqual(expect.any(String))
    expect(decryptJsonb(persisted.shippingOrigin)).toEqual({
      ...originalOrigin,
      ...updatedAddress,
    })
  })

  it('does not invent dispatch settings for incomplete or absent shipping origins', async () => {
    await seedUser()
    const updatedAddress = {
      street: '5 Rue de Test',
      city: 'Toulouse',
      postalCode: '31000',
      country: 'FR',
    }
    const incomplete = await seedShop({
      shippingOrigin: { carrierCutoffHour: 14 },
    })
    const absent = await seedShop({ id: 'shop-2', slug: 'absent-origin' })

    await updateShopInternal(incomplete.id, { shippingOrigin: updatedAddress })
    await updateShopInternal(absent.id, { shippingOrigin: updatedAddress })

    const [persistedIncomplete] = await db.select().from(shop).where(eq(shop.id, incomplete.id))
    const [persistedAbsent] = await db.select().from(shop).where(eq(shop.id, absent.id))
    expect(persistedIncomplete.shippingOrigin).toEqual(expect.any(String))
    expect(persistedAbsent.shippingOrigin).toEqual(expect.any(String))
    const incompleteOrigin = decryptJsonb<Record<string, unknown>>(
      persistedIncomplete.shippingOrigin,
    )
    const absentOrigin = decryptJsonb<Record<string, unknown>>(persistedAbsent.shippingOrigin)

    expect(incompleteOrigin).toEqual({ carrierCutoffHour: 14, ...updatedAddress })
    expect(incompleteOrigin).not.toHaveProperty('processingTimeDays')
    expect(incompleteOrigin).not.toHaveProperty('shipsInternational')
    expect(absentOrigin).toEqual(updatedAddress)
    expect(absentOrigin).not.toHaveProperty('processingTimeDays')
    expect(absentOrigin).not.toHaveProperty('shipsInternational')
  })

  it('clears the shipping origin with SQL NULL', async () => {
    await seedUser()
    const s = await seedShop({
      shippingOrigin: encryptJsonb({
        street: '6 Clear Way',
        city: 'Bordeaux',
        postalCode: '33000',
        country: 'FR',
        processingTimeDays: { min: 3, max: 5 },
        shipsInternational: true,
      }),
    })

    const updated = await updateShopInternal(s.id, { shippingOrigin: null })

    const [persisted] = await db.select().from(shop).where(eq(shop.id, s.id))
    expect(updated.shippingOrigin).toBeNull()
    expect(persisted.shippingOrigin).toBeNull()
  })

  it('throws when shop does not exist', async () => {
    await seedUser()
    await expect(updateShopInternal('nonexistent', { name: 'Nope' })).rejects.toThrow(
      'Shop not found.',
    )
  })

  it('throws when name is empty after trim', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { name: '   ' })).rejects.toThrow(
      'Shop name cannot be empty.',
    )
  })

  it('throws when slug is empty after trim', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { slug: '   ' })).rejects.toThrow(
      'Shop slug cannot be empty.',
    )
  })

  it('throws when slug contains invalid characters', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { slug: 'Invalid_Slug' })).rejects.toThrow(
      'Slug must be URL-safe: lowercase letters, numbers, and hyphens only.',
    )
  })

  it('throws when slug contains spaces', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { slug: 'invalid slug' })).rejects.toThrow(
      'Slug must be URL-safe: lowercase letters, numbers, and hyphens only.',
    )
  })

  it('throws when slug contains uppercase letters', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { slug: 'Invalid-Slug' })).rejects.toThrow(
      'Slug must be URL-safe: lowercase letters, numbers, and hyphens only.',
    )
  })

  it('trims whitespace from name and slug', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      name: '  Trimmed Name  ',
      slug: '  trimmed-slug  ',
    })
    expect(updated.name).toBe('Trimmed Name')
    expect(updated.slug).toBe('trimmed-slug')
  })

  it('persists updatedAt change', async () => {
    await seedUser()
    const s = await seedShop()
    const before = new Date()
    const updated = await updateShopInternal(s.id, { name: 'Updated' })
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('throws when isVatRegistered is true but vatId is missing', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { isVatRegistered: true })).rejects.toThrow(
      'VAT ID is required when VAT registered.',
    )
  })

  it('throws when isVatRegistered is true but vatId is empty string', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { isVatRegistered: true, vatId: '' })).rejects.toThrow(
      'VAT ID is required when VAT registered.',
    )
  })

  it('throws when vatId format is invalid', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(
      updateShopInternal(s.id, { isVatRegistered: true, vatId: 'INVALID' }),
    ).rejects.toThrow('Unrecognised country code in VAT ID')
  })

  it('updates VAT settings when vatId is valid', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      isVatRegistered: true,
      vatId: 'FRXX123456789',
    })
    expect(updated.isVatRegistered).toBe(true)
    expect(updated.vatId).toBe('FRXX123456789')
  })

  it('validates existing vatId when isVatRegistered is toggled to true', async () => {
    await seedUser()
    const s = await seedShop({ vatId: 'DE123456789' })
    const updated = await updateShopInternal(s.id, { isVatRegistered: true })
    expect(updated.isVatRegistered).toBe(true)
    expect(updated.vatId).toBe('DE123456789')
  })

  it('throws when existing vatId is invalid and isVatRegistered is toggled to true', async () => {
    await seedUser()
    const s = await seedShop({ vatId: 'BAD' })
    await expect(updateShopInternal(s.id, { isVatRegistered: true })).rejects.toThrow(
      'Unrecognised country code in VAT ID',
    )
  })

  it('persists DAC7 tax identity fields', async () => {
    await seedUser()
    const s = await seedShop()
    const updated = await updateShopInternal(s.id, {
      legalEntityType: 'individual',
      dateOfBirth: '1985-06-15',
      taxId: 'FR1234567890',
      businessRegistrationNumber: null,
    })
    expect(updated.legalEntityType).toBe('individual')
    expect(updated.dateOfBirth).toBe('1985-06-15')
    expect(updated.taxId).toBe('FR1234567890')
    expect(updated.businessRegistrationNumber).toBeNull()
  })

  it('persists business DAC7 fields and clears optional dateOfBirth', async () => {
    await seedUser()
    const s = await seedShop({
      legalEntityType: 'individual',
      dateOfBirth: '1985-06-15',
      taxId: 'TIN123',
      businessRegistrationNumber: null,
    })
    const updated = await updateShopInternal(s.id, {
      legalEntityType: 'business',
      dateOfBirth: null,
      taxId: 'TIN123',
      businessRegistrationNumber: 'RCS PARIS 123 456 789',
    })
    expect(updated.legalEntityType).toBe('business')
    expect(updated.dateOfBirth).toBeNull()
    expect(updated.taxId).toBe('TIN123')
    expect(updated.businessRegistrationNumber).toBe('RCS PARIS 123 456 789')
  })

  it('round-trips explicit trader declarations independently from DAC7 identity', async () => {
    await seedUser()
    const s = await seedShop()

    const declaredTrader = await updateShopInternal(s.id, { traderStatus: 'trader' })
    expect(declaredTrader.traderStatus).toBe('trader')
    expect(declaredTrader.legalEntityType).toBeNull()

    const businessDac7Identity = await updateShopInternal(s.id, {
      legalEntityType: 'business',
      dateOfBirth: null,
      taxId: 'TIN123',
      businessRegistrationNumber: 'RCS PARIS 123 456 789',
    })
    expect(businessDac7Identity.traderStatus).toBe('trader')
    expect(businessDac7Identity.legalEntityType).toBe('business')

    const declaredNonTrader = await updateShopInternal(s.id, { traderStatus: 'non_trader' })
    expect(declaredNonTrader.traderStatus).toBe('non_trader')
    expect(declaredNonTrader.legalEntityType).toBe('business')

    const individualDac7Identity = await updateShopInternal(s.id, {
      legalEntityType: 'individual',
      dateOfBirth: '1985-06-15',
      taxId: 'FR1234567890',
      businessRegistrationNumber: null,
    })
    const [persisted] = await db.select().from(shop).where(eq(shop.id, s.id))
    expect(individualDac7Identity.traderStatus).toBe('non_trader')
    expect(persisted).toMatchObject({
      traderStatus: 'non_trader',
      legalEntityType: 'individual',
      dateOfBirth: '1985-06-15',
      taxId: 'FR1234567890',
      businessRegistrationNumber: null,
    })
  })

  it('rejects an invalid taxId format', async () => {
    await seedUser()
    const s = await seedShop()
    await expect(updateShopInternal(s.id, { taxId: '!' })).rejects.toThrow(
      'Tax ID must be 3–30 alphanumeric characters',
    )
  })

  it('rejects an unsupported social platform', async () => {
    await seedUser()
    const s = await seedShop()

    await expect(
      updateShopInternal(s.id, {
        socials: [{ platform: 'myspace' as 'website', url: 'https://myspace.com/test' }],
      }),
    ).rejects.toBeTruthy()
  })

  it('persists supported social platforms', async () => {
    await seedUser()
    const s = await seedShop()

    await updateShopInternal(s.id, {
      socials: [
        { platform: 'instagram', url: 'https://instagram.com/test' },
        { platform: 'website', url: 'https://example.com' },
      ],
    })

    const socials = await db.select().from(shopSocials).where(eq(shopSocials.shopId, s.id))
    expect(socials).toHaveLength(2)
    expect(socials.map((s) => s.platform).sort()).toEqual(['instagram', 'website'])
  })
})
