import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '#/db/index'
import {
  customerNote,
  customerTag,
  orderItem,
  platformOrder,
  shop,
  shopOrder,
  user,
} from '#/db/schema'
import { hashEmail, listShopCustomers } from './customers.server'
import {
  addCustomerNoteSchema,
  addCustomerTagSchema,
  listCustomersSchema,
} from './customers.schema'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await db.delete(customerNote)
  await db.delete(customerTag)
  await db.delete(orderItem)
  await db.delete(shopOrder)
  await db.delete(platformOrder)
  await db.delete(shop)
  await db.delete(user)
})

describe('hashEmail', () => {
  it('produces a deterministic hex hash', () => {
    const a = hashEmail('Alice@Example.COM ')
    const b = hashEmail('alice@example.com')
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe('listCustomersSchema', () => {
  it('accepts minimal valid input', () => {
    const result = listCustomersSchema.safeParse({ shopId: 'shop_1' })
    expect(result.success).toBe(true)
  })

  it('rejects missing shopId', () => {
    const result = listCustomersSchema.safeParse({ page: 2 })
    expect(result.success).toBe(false)
  })

  it('rejects oversized pageSize', () => {
    const result = listCustomersSchema.safeParse({ shopId: 'shop_1', pageSize: 200 })
    expect(result.success).toBe(false)
  })
})

describe('addCustomerNoteSchema', () => {
  it('accepts valid note input', () => {
    const result = addCustomerNoteSchema.safeParse({
      shopId: 'shop_1',
      customerEmailHash: 'a'.repeat(64),
      content: 'VIP customer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects content over max length', () => {
    const result = addCustomerNoteSchema.safeParse({
      shopId: 'shop_1',
      customerEmailHash: 'a'.repeat(64),
      content: 'a'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('addCustomerTagSchema', () => {
  it('accepts valid tag input', () => {
    const result = addCustomerTagSchema.safeParse({
      shopId: 'shop_1',
      customerEmailHash: 'a'.repeat(64),
      tag: 'wholesale',
    })
    expect(result.success).toBe(true)
  })

  it('rejects oversized tag', () => {
    const result = addCustomerTagSchema.safeParse({
      shopId: 'shop_1',
      customerEmailHash: 'a'.repeat(64),
      tag: 'a'.repeat(51),
    })
    expect(result.success).toBe(false)
  })
})

describe('listShopCustomers', () => {
  it('returns empty pagination when no customers exist', async () => {
    const result = await listShopCustomers('shop_no_customers', { page: 1, pageSize: 20 })
    expect(result.customers).toEqual([])
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })
})
