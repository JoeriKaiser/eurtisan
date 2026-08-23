import { createHash } from 'node:crypto'
import { and, count, desc, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm'
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
import { logger } from '../logger.server'
import type { OrderStatus } from '../orders.server'
import { writeAuditLog, type AuditActor } from '../audit-logger'

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

function emailHashExpression(emailColumn: SQL): SQL {
  return sql`encode(digest(lower(${emailColumn}), 'sha256'), 'hex')`
}

export interface ShopCustomerListItem {
  emailHash: string
  email: string
  name: string
  orderCount: number
  totalSpentCents: number
  firstOrderAt: Date
  lastOrderAt: Date
  tags: string[]
  noteCount: number
}

export interface ShopCustomerDetail {
  emailHash: string
  email: string
  name: string
  userId: string
  orderCount: number
  totalSpentCents: number
  firstOrderAt: Date
  lastOrderAt: Date
  tags: string[]
  notes: CustomerNoteDetail[]
  orders: CustomerOrderSummary[]
}

export interface CustomerOrderSummary {
  shopOrderId: string
  platformOrderId: string
  /** Typed so the UI can render a translated label rather than the raw enum. */
  status: OrderStatus
  subtotalCents: number
  itemCount: number
  createdAt: Date
}

export interface CustomerNoteDetail {
  id: string
  content: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export interface ShopCustomersResult {
  customers: ShopCustomerListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CustomerDataExport {
  exportedAt: string
  shopId: string
  customerEmailHash: string
  customerEmail: string
  customerName: string
  orders: Array<{
    shopOrderId: string
    platformOrderId: string
    status: string
    subtotalCents: number
    itemCount: number
    createdAt: string
    items: Array<{
      productId: string
      productName: string
      quantity: number
      unitPriceCents: number
      totalCents: number
    }>
  }>
  notes: Array<{
    id: string
    content: string
    createdByName: string
    createdAt: string
    updatedAt: string
  }>
  tags: string[]
}

export async function listShopCustomers(
  shopId: string,
  options: { page: number; pageSize: number; search?: string },
): Promise<ShopCustomersResult> {
  const page = Math.max(1, options.page)
  const pageSize = Math.min(100, Math.max(1, options.pageSize))
  const search = options.search?.trim().toLowerCase()

  const havingClause = search
    ? sql`${ilike(sql`LOWER(${user.email})`, `%${search}%`)} OR ${ilike(sql`LOWER(${user.name})`, `%${search}%`)}`
    : undefined

  const baseQuery = db
    .select({
      email: user.email,
      name: user.name,
      userId: user.id,
      orderCount: count(shopOrder.id),
      totalSpentCents: sql<number>`COALESCE(SUM(${shopOrder.subtotalCents}), 0)`,
      firstOrderAt: sql<Date>`MIN(${shopOrder.createdAt})`,
      lastOrderAt: sql<Date>`MAX(${shopOrder.createdAt})`,
    })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .where(eq(shopOrder.shopId, shopId))
    .groupBy(user.id, user.email, user.name)

  const customersRows = await baseQuery
    .having(havingClause)
    .orderBy(desc(sql`MAX(${shopOrder.createdAt})`))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const totalResult = await db
    .select({ total: count() })
    .from(baseQuery.having(havingClause).as('filtered_customers'))

  const total = Number(totalResult[0]?.total ?? 0)

  const emailHashes = customersRows.map((r) => hashEmail(r.email))

  const [tagsRows, notesCountRows] = await Promise.all([
    emailHashes.length > 0
      ? db
          .select({ emailHash: customerTag.customerEmailHash, tag: customerTag.tag })
          .from(customerTag)
          .where(
            and(
              eq(customerTag.shopId, shopId),
              inArray(customerTag.customerEmailHash, emailHashes),
            ),
          )
      : Promise.resolve([]),
    emailHashes.length > 0
      ? db
          .select({ emailHash: customerNote.customerEmailHash, noteCount: count() })
          .from(customerNote)
          .where(
            and(
              eq(customerNote.shopId, shopId),
              inArray(customerNote.customerEmailHash, emailHashes),
            ),
          )
          .groupBy(customerNote.customerEmailHash)
      : Promise.resolve([]),
  ])

  const tagsByHash = new Map<string, string[]>()
  for (const row of tagsRows) {
    const list = tagsByHash.get(row.emailHash) ?? []
    list.push(row.tag)
    tagsByHash.set(row.emailHash, list)
  }

  const noteCountByHash = new Map(notesCountRows.map((r) => [r.emailHash, Number(r.noteCount)]))

  const customers: ShopCustomerListItem[] = customersRows.map((row) => ({
    emailHash: hashEmail(row.email),
    email: row.email,
    name: row.name,
    orderCount: Number(row.orderCount),
    totalSpentCents: Number(row.totalSpentCents),
    firstOrderAt: row.firstOrderAt,
    lastOrderAt: row.lastOrderAt,
    tags: tagsByHash.get(hashEmail(row.email)) ?? [],
    noteCount: noteCountByHash.get(hashEmail(row.email)) ?? 0,
  }))

  return {
    customers,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getShopCustomerDetail(
  shopId: string,
  customerEmailHash: string,
): Promise<ShopCustomerDetail | null> {
  const rows = await db
    .select({
      email: user.email,
      name: user.name,
      userId: user.id,
      shopOrderId: shopOrder.id,
      platformOrderId: shopOrder.platformOrderId,
      status: shopOrder.status,
      subtotalCents: shopOrder.subtotalCents,
      orderCreatedAt: shopOrder.createdAt,
      itemCount: count(orderItem.id),
    })
    .from(shopOrder)
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .leftJoin(orderItem, eq(orderItem.shopOrderId, shopOrder.id))
    .where(
      and(
        eq(shopOrder.shopId, shopId),
        eq(emailHashExpression(sql`${user.email}`), customerEmailHash),
      ),
    )
    .groupBy(
      user.id,
      user.email,
      user.name,
      shopOrder.id,
      shopOrder.platformOrderId,
      shopOrder.status,
      shopOrder.subtotalCents,
      shopOrder.createdAt,
    )
    .orderBy(desc(shopOrder.createdAt))

  if (rows.length === 0) return null

  const firstRow = rows[0]
  const email = firstRow.email
  const emailHash = hashEmail(email)

  const [tagsRows, notesRows] = await Promise.all([
    db
      .select({ tag: customerTag.tag })
      .from(customerTag)
      .where(and(eq(customerTag.shopId, shopId), eq(customerTag.customerEmailHash, emailHash)))
      .orderBy(customerTag.tag),
    db
      .select({
        id: customerNote.id,
        content: customerNote.content,
        createdByName: user.name,
        createdAt: customerNote.createdAt,
        updatedAt: customerNote.updatedAt,
      })
      .from(customerNote)
      .innerJoin(user, eq(customerNote.createdBy, user.id))
      .where(and(eq(customerNote.shopId, shopId), eq(customerNote.customerEmailHash, emailHash)))
      .orderBy(desc(customerNote.createdAt)),
  ])

  const orderCount = rows.length
  const totalSpentCents = rows.reduce((sum, r) => sum + r.subtotalCents, 0)
  const firstOrderAt = rows.reduce(
    (min, r) => (r.orderCreatedAt < min ? r.orderCreatedAt : min),
    rows[0].orderCreatedAt,
  )
  const lastOrderAt = rows.reduce(
    (max, r) => (r.orderCreatedAt > max ? r.orderCreatedAt : max),
    rows[0].orderCreatedAt,
  )

  return {
    emailHash,
    email,
    name: firstRow.name,
    userId: firstRow.userId,
    orderCount,
    totalSpentCents,
    firstOrderAt,
    lastOrderAt,
    tags: tagsRows.map((r) => r.tag),
    notes: notesRows.map((r) => ({
      id: r.id,
      content: r.content,
      createdByName: r.createdByName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    orders: rows.map((r) => ({
      shopOrderId: r.shopOrderId,
      platformOrderId: r.platformOrderId,
      status: r.status,
      subtotalCents: r.subtotalCents,
      itemCount: Number(r.itemCount),
      createdAt: r.orderCreatedAt,
    })),
  }
}

export async function addCustomerNote(
  shopId: string,
  customerEmailHash: string,
  content: string,
  actor: AuditActor,
): Promise<CustomerNoteDetail> {
  const detail = await getShopCustomerDetail(shopId, customerEmailHash)
  if (!detail) {
    throw new Error('NOT_FOUND')
  }

  const [note] = await db
    .insert(customerNote)
    .values({
      id: crypto.randomUUID(),
      shopId,
      customerEmailHash,
      content: content.trim(),
      createdBy: actor.id,
    })
    .returning()

  await writeAuditLog({
    actor,
    action: 'customer_note_created',
    resourceType: 'customer_note',
    resourceId: note.id,
    metadata: { shopId, customerEmailHash },
  })

  return {
    id: note.id,
    content: note.content,
    createdByName: actor.name ?? 'Unknown',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

/**
 * Mirrors the addCustomerNote contract gate: the caller must own the shop the
 * note belongs to. Deny-by-default for every other caller, including admins,
 * since customer notes are private seller CRM data.
 */
async function assertNoteShopOwnership(shopId: string, actor: AuditActor): Promise<void> {
  const [shopRecord] = await db
    .select({ ownerId: shop.ownerId })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!shopRecord || shopRecord.ownerId !== actor.id) {
    throw new Error('FORBIDDEN')
  }
}

export async function updateCustomerNote(
  noteId: string,
  content: string,
  actor: AuditActor,
): Promise<CustomerNoteDetail> {
  const existing = await db
    .select({
      id: customerNote.id,
      shopId: customerNote.shopId,
      customerEmailHash: customerNote.customerEmailHash,
    })
    .from(customerNote)
    .where(eq(customerNote.id, noteId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  await assertNoteShopOwnership(existing[0].shopId, actor)

  const [updated] = await db
    .update(customerNote)
    .set({ content: content.trim(), updatedAt: new Date() })
    .where(eq(customerNote.id, noteId))
    .returning()

  const [row] = await db
    .select({ name: user.name })
    .from(customerNote)
    .innerJoin(user, eq(customerNote.createdBy, user.id))
    .where(eq(customerNote.id, noteId))
    .limit(1)

  await writeAuditLog({
    actor,
    action: 'customer_note_updated',
    resourceType: 'customer_note',
    resourceId: noteId,
    metadata: { shopId: existing[0].shopId, customerEmailHash: existing[0].customerEmailHash },
  })

  return {
    id: updated.id,
    content: updated.content,
    createdByName: row?.name ?? 'Unknown',
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

export async function deleteCustomerNote(noteId: string, actor: AuditActor) {
  const existing = await db
    .select({
      id: customerNote.id,
      shopId: customerNote.shopId,
      customerEmailHash: customerNote.customerEmailHash,
    })
    .from(customerNote)
    .where(eq(customerNote.id, noteId))
    .limit(1)

  if (!existing[0]) {
    throw new Error('NOT_FOUND')
  }

  await assertNoteShopOwnership(existing[0].shopId, actor)

  await db.delete(customerNote).where(eq(customerNote.id, noteId))

  await writeAuditLog({
    actor,
    action: 'customer_note_deleted',
    resourceType: 'customer_note',
    resourceId: noteId,
    metadata: { shopId: existing[0].shopId, customerEmailHash: existing[0].customerEmailHash },
  })
}

export async function addCustomerTag(
  shopId: string,
  customerEmailHash: string,
  tag: string,
  actor: AuditActor,
) {
  const detail = await getShopCustomerDetail(shopId, customerEmailHash)
  if (!detail) {
    throw new Error('NOT_FOUND')
  }

  const sanitized = tag.trim().toLowerCase().slice(0, 50)
  if (!sanitized) {
    throw new Error('INVALID_TAG')
  }

  try {
    const [row] = await db
      .insert(customerTag)
      .values({
        id: crypto.randomUUID(),
        shopId,
        customerEmailHash,
        tag: sanitized,
      })
      .onConflictDoNothing()
      .returning()

    await writeAuditLog({
      actor,
      action: 'customer_tag_added',
      resourceType: 'customer_tag',
      resourceId: row?.id ?? `${shopId}:${customerEmailHash}:${sanitized}`,
      metadata: { shopId, customerEmailHash, tag: sanitized },
    })

    return sanitized
  } catch (err) {
    logger.error('Failed to add customer tag', err, { shopId, customerEmailHash, tag: sanitized })
    throw new Error('FAILED_TO_ADD_TAG')
  }
}

export async function removeCustomerTag(
  shopId: string,
  customerEmailHash: string,
  tag: string,
  actor: AuditActor,
) {
  const sanitized = tag.trim().toLowerCase()
  await db
    .delete(customerTag)
    .where(
      and(
        eq(customerTag.shopId, shopId),
        eq(customerTag.customerEmailHash, customerEmailHash),
        eq(customerTag.tag, sanitized),
      ),
    )

  await writeAuditLog({
    actor,
    action: 'customer_tag_removed',
    resourceType: 'customer_tag',
    resourceId: `${shopId}:${customerEmailHash}:${sanitized}`,
    metadata: { shopId, customerEmailHash, tag: sanitized },
  })
}

export async function exportCustomerData(
  shopId: string,
  customerEmailHash: string,
): Promise<CustomerDataExport> {
  const detail = await getShopCustomerDetail(shopId, customerEmailHash)
  if (!detail) {
    throw new Error('NOT_FOUND')
  }

  const orderItems = await db
    .select({
      shopOrderId: orderItem.shopOrderId,
      productId: orderItem.productId,
      productName: orderItem.productName,
      quantity: orderItem.quantity,
      unitPriceCents: orderItem.unitPriceCents,
      totalCents: orderItem.totalCents,
    })
    .from(orderItem)
    .innerJoin(shopOrder, eq(orderItem.shopOrderId, shopOrder.id))
    .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
    .innerJoin(user, eq(platformOrder.userId, user.id))
    .where(
      and(
        eq(shopOrder.shopId, shopId),
        eq(emailHashExpression(sql`${user.email}`), customerEmailHash),
      ),
    )

  return {
    exportedAt: new Date().toISOString(),
    shopId,
    customerEmailHash,
    customerEmail: detail.email,
    customerName: detail.name,
    orders: detail.orders.map((order) => ({
      shopOrderId: order.shopOrderId,
      platformOrderId: order.platformOrderId,
      status: order.status,
      subtotalCents: order.subtotalCents,
      itemCount: order.itemCount,
      createdAt: order.createdAt.toISOString(),
      items: orderItems.flatMap((item) =>
        item.shopOrderId === order.shopOrderId
          ? [
              {
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                totalCents: item.totalCents,
              },
            ]
          : [],
      ),
    })),
    notes: detail.notes.map((note) => ({
      id: note.id,
      content: note.content,
      createdByName: note.createdByName,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    tags: detail.tags,
  }
}
