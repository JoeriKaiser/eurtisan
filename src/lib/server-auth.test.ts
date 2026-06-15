import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { shop, user } from '#/db/schema'

import {
  becomeCreatorInternal,
  requireAuthUser,
  requirePrivileged2FA,
  requireRoleUser,
  verifyShopOwnership,
} from './server-auth'
import { auth } from './auth'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

const mockGetSession = auth.api.getSession as unknown as ReturnType<typeof vi.fn>

beforeEach(async () => {
  await db.delete(shop)
  await db.delete(user)
})

async function seedCustomer(overrides?: Partial<typeof user.$inferInsert>) {
  return db
    .insert(user)
    .values({
      id: 'user-1',
      name: 'Test Customer',
      email: 'customer@example.com',
      emailVerified: true,
      role: 'customer',
      ...overrides,
    })
    .returning()
    .then((rows) => rows[0])
}

describe('becomeCreatorInternal', () => {
  it('upgrades a customer to creator', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {
      shopName: 'Test Shop',
      shopSlug: 'test-shop',
    })

    const updatedUser = await db.query.user.findFirst({
      where: (u) => eq(u.id, customer.id),
    })
    expect(updatedUser?.role).toBe('creator')
  })

  it('creates a shop with status draft', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {
      shopName: 'Test Shop',
      shopSlug: 'test-shop',
    })

    const createdShop = await db.query.shop.findFirst({
      where: (s) => eq(s.ownerId, customer.id),
    })
    expect(createdShop).toBeDefined()
    expect(createdShop?.status).toBe('draft')
    expect(createdShop?.name).toBe('Test Shop')
    expect(createdShop?.slug).toBe('test-shop')
  })

  it('does not create a shop when shopName or shopSlug is missing', async () => {
    const customer = await seedCustomer()

    await becomeCreatorInternal(customer.id, customer.role, {})

    const shops = await db.select().from(shop).where(eq(shop.ownerId, customer.id))
    expect(shops.length).toBe(0)
  })

  it('throws FORBIDDEN when user is not a customer', async () => {
    const creator = await seedCustomer({ role: 'creator' })

    await expect(
      becomeCreatorInternal(creator.id, creator.role, {
        shopName: 'Test Shop',
        shopSlug: 'test-shop',
      }),
    ).rejects.toThrow('FORBIDDEN')
  })
})

function makeSafeUser(role: 'customer' | 'creator' | 'admin', twoFactorEnabled: boolean) {
  return {
    id: 'user-1',
    name: 'Test',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    role,
    bannedAt: null,
    deletedAt: null,
    twoFactorEnabled,
  }
}

describe('requirePrivileged2FA', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws TWO_FACTOR_REQUIRED for an admin without 2FA outside dev/test', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('admin', false))).toThrow('TWO_FACTOR_REQUIRED')
  })

  it('throws TWO_FACTOR_REQUIRED for a creator without 2FA outside dev/test', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('creator', false))).toThrow(
      'TWO_FACTOR_REQUIRED',
    )
  })

  it('does not throw for a customer without 2FA', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('customer', false))).not.toThrow()
  })

  it('does not throw when the privileged user has 2FA enabled', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('admin', true))).not.toThrow()
    expect(() => requirePrivileged2FA(makeSafeUser('creator', true))).not.toThrow()
  })

  it('bypasses the check in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('admin', false))).not.toThrow()
  })

  it('bypasses the check when E2E_TEST is true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('E2E_TEST', 'true')
    vi.stubEnv('VITEST', 'false')

    expect(() => requirePrivileged2FA(makeSafeUser('creator', false))).not.toThrow()
  })

  it('bypasses the check when VITEST is true', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VITEST', 'true')

    expect(() => requirePrivileged2FA(makeSafeUser('admin', false))).not.toThrow()
  })
})

describe('deleted user rejection', () => {
  it('requireAuthUser treats a deleted user as unauthenticated', async () => {
    const customer = await seedCustomer({ deletedAt: new Date() })
    mockGetSession.mockResolvedValue({
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        emailVerified: customer.emailVerified,
        image: null,
        role: customer.role,
      },
      session: { id: 'session-1', token: 'tok', expiresAt: new Date(), userId: customer.id },
    })

    await expect(requireAuthUser()).rejects.toThrow('UNAUTHENTICATED')
  })

  it('requireRoleUser treats a deleted user as unauthenticated', async () => {
    const customer = await seedCustomer({ deletedAt: new Date() })
    mockGetSession.mockResolvedValue({
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        emailVerified: customer.emailVerified,
        image: null,
        role: customer.role,
      },
      session: { id: 'session-1', token: 'tok', expiresAt: new Date(), userId: customer.id },
    })

    await expect(requireRoleUser({ data: { minRole: 'customer' } })).rejects.toThrow(
      'UNAUTHENTICATED',
    )
  })

  it('verifyShopOwnership treats a deleted user as unauthenticated', async () => {
    const customer = await seedCustomer({ deletedAt: new Date() })
    mockGetSession.mockResolvedValue({
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        emailVerified: customer.emailVerified,
        image: null,
        role: customer.role,
      },
      session: { id: 'session-1', token: 'tok', expiresAt: new Date(), userId: customer.id },
    })

    await expect(verifyShopOwnership({ data: { shopId: 'shop-1' } })).rejects.toThrow(
      'UNAUTHENTICATED',
    )
  })
})
