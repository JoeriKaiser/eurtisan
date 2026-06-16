import { randomUUID } from 'node:crypto'
import { db } from '#/db/index'
import * as schema from '#/db/schema'
import type { ShopLike, UserLike } from '#/test/helpers'

export async function createCustomerNote(
  shop: ShopLike | string,
  createdBy: UserLike | string,
  overrides?: Partial<typeof schema.customerNote.$inferInsert>,
): Promise<typeof schema.customerNote.$inferSelect> {
  const shopId = typeof shop === 'string' ? shop : shop.id
  const createdById = typeof createdBy === 'string' ? createdBy : createdBy.id
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.customerNote)
    .values({
      shopId,
      customerEmailHash: `hash-${suffix}`,
      content: 'Test customer note',
      createdBy: createdById,
      ...overrides,
    })
    .returning()
  return row
}

export async function createCustomerTag(
  shop: ShopLike | string,
  overrides?: Partial<typeof schema.customerTag.$inferInsert>,
): Promise<typeof schema.customerTag.$inferSelect> {
  const shopId = typeof shop === 'string' ? shop : shop.id
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.customerTag)
    .values({
      shopId,
      customerEmailHash: `hash-${suffix}`,
      tag: `tag-${suffix}`,
      ...overrides,
    })
    .returning()
  return row
}

export async function createOwnerMessageThread(
  shop: ShopLike | string,
  overrides?: Partial<typeof schema.ownerMessageThread.$inferInsert>,
): Promise<typeof schema.ownerMessageThread.$inferSelect> {
  const shopId = typeof shop === 'string' ? shop : shop.id
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
  const [row] = await db
    .insert(schema.ownerMessageThread)
    .values({
      shopId,
      customerEmailHash: `hash-${suffix}`,
      subject: 'Test subject',
      ...overrides,
    })
    .returning()
  return row
}

export async function createOwnerMessage(
  thread: { id: string } | string,
  overrides?: Partial<typeof schema.ownerMessage.$inferInsert>,
): Promise<typeof schema.ownerMessage.$inferSelect> {
  const threadId = typeof thread === 'string' ? thread : thread.id
  const [row] = await db
    .insert(schema.ownerMessage)
    .values({
      threadId,
      senderRole: 'owner',
      body: 'Test message',
      ...overrides,
    })
    .returning()
  return row
}
