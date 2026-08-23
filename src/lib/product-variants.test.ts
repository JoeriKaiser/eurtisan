import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import {
  productOption,
  productOptionValue,
  productVariant,
  productVariantOption,
  type user,
} from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createProduct, createProductVariant, createShop, createUser } from '#/test/factories'

import type { ProductVariantMatrix } from './product-variants'
import {
  deleteProductOption,
  deleteProductVariant,
  updateProductOption,
  updateProductVariant,
} from './product-variants'
import type { SafeUser } from './server-auth'

/**
 * The RPC transport is replaced so the exported server functions can be
 * invoked in-process with an explicit auth context. Everything behind the
 * handler — the role gate, privileged-2FA gate, and the database-backed
 * ownership check — runs for real against the unit database.
 */
type HandlerArgs = { context: { user: SafeUser | null }; data: Record<string, unknown> }
type ServerFnHandler = (args: HandlerArgs) => Promise<unknown>

vi.mock('@tanstack/react-start', async (importOriginal) => {
  const actual = await importOriginal()

  const createServerFnStub = () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (handler: ServerFnHandler) =>
        Object.assign(
          async () => {
            throw new Error('RPC transport disabled in tests; invoke __handler directly')
          },
          { __handler: handler satisfies ServerFnHandler },
        ),
    }
    return chain
  }

  return { ...(actual as object), createServerFn: createServerFnStub }
})

// authz.ts imports the Better Auth configuration at module load; the role and
// ownership gates under test never touch it.
vi.mock('./auth/config.server', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

type UserRow = typeof user.$inferSelect

function handlerOf(serverFn: unknown): ServerFnHandler {
  const handler = (serverFn as { __handler?: ServerFnHandler }).__handler
  if (!handler) {
    throw new Error('Expected the mocked server function to expose its captured handler')
  }
  return handler
}

const updateOption = handlerOf(updateProductOption)
const deleteOption = handlerOf(deleteProductOption)
const updateVariant = handlerOf(updateProductVariant)
const deleteVariant = handlerOf(deleteProductVariant)

function asSession(row: UserRow): { user: SafeUser } {
  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: true,
      image: null,
      role: row.role,
      bannedAt: null,
      deletedAt: null,
      twoFactorEnabled: true,
    },
  }
}

beforeEach(async () => {
  await clearTestTables()
})

afterAll(async () => {
  await clearTestTables()
})

/** Owner plus a rival creator (with their own shop) and a plain customer. */
async function seedFixture() {
  const owner = await createUser({ role: 'creator' })
  const intruder = await createUser({ role: 'creator' })
  const customer = await createUser({ role: 'customer' })

  const shop = await createShop(owner)
  await createShop(intruder)

  const owned = await createProduct(shop)

  await db.insert(productOption).values({
    id: 'option-owned',
    productId: owned.id,
    name: 'Color',
    displayOrder: 0,
  })
  await db.insert(productOptionValue).values({
    id: 'value-owned',
    optionId: 'option-owned',
    value: 'Red',
    displayOrder: 0,
  })

  const variant = await createProductVariant(owned, {
    id: 'variant-owned',
    name: 'Red Tee',
    stockCount: 5,
  })
  await db.insert(productVariantOption).values({
    variantId: variant.id,
    optionValueId: 'value-owned',
  })

  return { owner, intruder, customer }
}

describe('updateProductOption authorization', () => {
  it('rejects unauthenticated callers', async () => {
    await seedFixture()

    await expect(
      updateOption({
        context: { user: null },
        data: { optionId: 'option-owned', name: 'Size', values: ['S'] },
      }),
    ).rejects.toThrow('UNAUTHENTICATED')
  })

  it('rejects customers below the creator role', async () => {
    const { customer } = await seedFixture()

    await expect(
      updateOption({
        context: asSession(customer),
        data: { optionId: 'option-owned', name: 'Size', values: ['S'] },
      }),
    ).rejects.toThrow(/Insufficient role/)
  })

  it('rejects a creator updating another shop’s option and leaves it untouched', async () => {
    const { intruder } = await seedFixture()

    await expect(
      updateOption({
        context: asSession(intruder),
        data: { optionId: 'option-owned', name: 'Hijacked', values: ['X'] },
      }),
    ).rejects.toThrow('FORBIDDEN')

    const [row] = await db.select().from(productOption).where(eq(productOption.id, 'option-owned'))
    expect(row?.name).toBe('Color')
  })

  it('lets the owner update their own option', async () => {
    const { owner } = await seedFixture()

    const matrix = (await updateOption({
      context: asSession(owner),
      data: { optionId: 'option-owned', name: 'Size', values: ['S', 'M'] },
    })) as ProductVariantMatrix

    expect(matrix.options).toHaveLength(1)
    expect(matrix.options[0]?.name).toBe('Size')
    expect(matrix.options[0]?.values.map((v) => v.value)).toEqual(['S', 'M'])

    const [row] = await db.select().from(productOption).where(eq(productOption.id, 'option-owned'))
    expect(row?.name).toBe('Size')
  })
})

describe('deleteProductOption authorization', () => {
  it('rejects unauthenticated callers', async () => {
    await seedFixture()

    await expect(
      deleteOption({ context: { user: null }, data: { optionId: 'option-owned' } }),
    ).rejects.toThrow('UNAUTHENTICATED')
  })

  it('rejects customers below the creator role', async () => {
    const { customer } = await seedFixture()

    await expect(
      deleteOption({ context: asSession(customer), data: { optionId: 'option-owned' } }),
    ).rejects.toThrow(/Insufficient role/)
  })

  it('rejects a creator deleting another shop’s option and leaves it untouched', async () => {
    const { intruder } = await seedFixture()

    await expect(
      deleteOption({ context: asSession(intruder), data: { optionId: 'option-owned' } }),
    ).rejects.toThrow('FORBIDDEN')

    const rows = await db.select().from(productOption).where(eq(productOption.id, 'option-owned'))
    expect(rows).toHaveLength(1)
  })

  it('lets the owner delete their own option', async () => {
    const { owner } = await seedFixture()

    const matrix = (await deleteOption({
      context: asSession(owner),
      data: { optionId: 'option-owned' },
    })) as ProductVariantMatrix

    expect(matrix.options).toHaveLength(0)
    // Variants built on the deleted option's values are removed with it so the
    // matrix stays consistent.
    expect(matrix.variants).toHaveLength(0)

    const optionRows = await db
      .select()
      .from(productOption)
      .where(eq(productOption.id, 'option-owned'))
    expect(optionRows).toHaveLength(0)
  })
})

describe('updateProductVariant authorization', () => {
  it('rejects unauthenticated callers', async () => {
    await seedFixture()

    await expect(
      updateVariant({
        context: { user: null },
        data: { variantId: 'variant-owned', name: 'Stolen', stockCount: 1 },
      }),
    ).rejects.toThrow('UNAUTHENTICATED')
  })

  it('rejects customers below the creator role', async () => {
    const { customer } = await seedFixture()

    await expect(
      updateVariant({
        context: asSession(customer),
        data: { variantId: 'variant-owned', name: 'Stolen', stockCount: 1 },
      }),
    ).rejects.toThrow(/Insufficient role/)
  })

  it('rejects a creator updating another shop’s variant and leaves it untouched', async () => {
    const { intruder } = await seedFixture()

    await expect(
      updateVariant({
        context: asSession(intruder),
        data: { variantId: 'variant-owned', name: 'Hijacked', stockCount: 0 },
      }),
    ).rejects.toThrow('FORBIDDEN')

    const [row] = await db
      .select()
      .from(productVariant)
      .where(eq(productVariant.id, 'variant-owned'))
    expect(row?.name).toBe('Red Tee')
    expect(row?.stockCount).toBe(5)
  })

  it('lets the owner update their own variant', async () => {
    const { owner } = await seedFixture()

    const matrix = (await updateVariant({
      context: asSession(owner),
      data: {
        variantId: 'variant-owned',
        name: 'Red Tee Relaxed',
        sku: 'TEE-RED',
        priceAdjustmentCents: 500,
        stockCount: 9,
        isActive: false,
      },
    })) as ProductVariantMatrix

    expect(matrix.variants[0]?.name).toBe('Red Tee Relaxed')
    expect(matrix.variants[0]?.priceAdjustmentCents).toBe(500)
    expect(matrix.variants[0]?.stockCount).toBe(9)

    const [row] = await db
      .select()
      .from(productVariant)
      .where(eq(productVariant.id, 'variant-owned'))
    expect(row?.name).toBe('Red Tee Relaxed')
    expect(row?.stockCount).toBe(9)
  })
})

describe('deleteProductVariant authorization', () => {
  it('rejects unauthenticated callers', async () => {
    await seedFixture()

    await expect(
      deleteVariant({ context: { user: null }, data: { variantId: 'variant-owned' } }),
    ).rejects.toThrow('UNAUTHENTICATED')
  })

  it('rejects customers below the creator role', async () => {
    const { customer } = await seedFixture()

    await expect(
      deleteVariant({ context: asSession(customer), data: { variantId: 'variant-owned' } }),
    ).rejects.toThrow(/Insufficient role/)
  })

  it('rejects a creator deleting another shop’s variant and leaves it untouched', async () => {
    const { intruder } = await seedFixture()

    await expect(
      deleteVariant({ context: asSession(intruder), data: { variantId: 'variant-owned' } }),
    ).rejects.toThrow('FORBIDDEN')

    const rows = await db
      .select()
      .from(productVariant)
      .where(eq(productVariant.id, 'variant-owned'))
    expect(rows).toHaveLength(1)
  })

  it('lets the owner delete their own variant', async () => {
    const { owner } = await seedFixture()

    const matrix = (await deleteVariant({
      context: asSession(owner),
      data: { variantId: 'variant-owned' },
    })) as ProductVariantMatrix

    expect(matrix.variants).toHaveLength(0)

    const rows = await db
      .select()
      .from(productVariant)
      .where(eq(productVariant.id, 'variant-owned'))
    expect(rows).toHaveLength(0)
  })
})

describe('variant mutations preserve NOT_FOUND semantics', () => {
  it('throws NOT_FOUND for missing resources regardless of caller', async () => {
    const { owner } = await seedFixture()
    const session = asSession(owner)

    await expect(
      updateOption({ context: session, data: { optionId: 'missing', name: 'X', values: ['x'] } }),
    ).rejects.toThrow('NOT_FOUND')
    await expect(deleteOption({ context: session, data: { optionId: 'missing' } })).rejects.toThrow(
      'NOT_FOUND',
    )
    await expect(
      updateVariant({ context: session, data: { variantId: 'missing', name: 'X' } }),
    ).rejects.toThrow('NOT_FOUND')
    await expect(
      deleteVariant({ context: session, data: { variantId: 'missing' } }),
    ).rejects.toThrow('NOT_FOUND')
  })
})
