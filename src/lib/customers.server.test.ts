import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '#/db/index'
import { auditLog, customerNote } from '#/db/schema'
import { clearTestTables } from '#/test/cleanup'
import { createCustomerNote, createShop, createUser } from '#/test/factories'

import {
  addCustomerNoteSchema,
  addCustomerTagSchema,
  listCustomersSchema,
} from './customers.schema'
import {
  deleteCustomerNote,
  hashEmail,
  listShopCustomers,
  updateCustomerNote,
} from './customers.server'

vi.mock('./auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

beforeEach(async () => {
  await clearTestTables()
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

describe('customer note ownership', () => {
  const actorFor = (u: { id: string; name: string | null }) => ({ id: u.id, name: u.name })

  async function seedOwnedNote() {
    const owner = await createUser({ role: 'creator', name: 'Owner' })
    const shop = await createShop(owner)
    const note = await createCustomerNote(shop, owner)
    return { owner, shop, note }
  }

  it('rejects a cross-shop update with FORBIDDEN and leaves the note untouched', async () => {
    const { note } = await seedOwnedNote()
    const intruder = await createUser({ role: 'creator', name: 'Intruder' })

    await expect(
      updateCustomerNote(note.id, 'Tampered content', actorFor(intruder)),
    ).rejects.toThrow('FORBIDDEN')

    const [row] = await db.select().from(customerNote).where(eq(customerNote.id, note.id))
    expect(row?.content).toBe(note.content)
    expect(await db.select().from(auditLog)).toEqual([])
  })

  it('lets the owner update their own note and audits it with shop metadata', async () => {
    const { owner, shop, note } = await seedOwnedNote()

    const updated = await updateCustomerNote(note.id, 'Followed up by phone', actorFor(owner))

    expect(updated.content).toBe('Followed up by phone')
    const [log] = await db.select().from(auditLog).where(eq(auditLog.resourceId, note.id))
    expect(log).toMatchObject({
      actorId: owner.id,
      action: 'customer_note_updated',
      resourceType: 'customer_note',
      metadata: { shopId: shop.id, customerEmailHash: note.customerEmailHash },
    })
  })

  it('rejects a cross-shop delete with FORBIDDEN and keeps the note', async () => {
    const { note } = await seedOwnedNote()
    const intruder = await createUser({ role: 'creator', name: 'Intruder' })

    await expect(deleteCustomerNote(note.id, actorFor(intruder))).rejects.toThrow('FORBIDDEN')

    const rows = await db.select().from(customerNote).where(eq(customerNote.id, note.id))
    expect(rows).toHaveLength(1)
    expect(await db.select().from(auditLog)).toEqual([])
  })

  it('lets the owner delete their own note and audits it with shop metadata', async () => {
    const { owner, shop, note } = await seedOwnedNote()

    await deleteCustomerNote(note.id, actorFor(owner))

    const rows = await db.select().from(customerNote).where(eq(customerNote.id, note.id))
    expect(rows).toHaveLength(0)
    const [log] = await db.select().from(auditLog).where(eq(auditLog.resourceId, note.id))
    expect(log).toMatchObject({
      actorId: owner.id,
      action: 'customer_note_deleted',
      resourceType: 'customer_note',
      metadata: { shopId: shop.id, customerEmailHash: note.customerEmailHash },
    })
  })
})
