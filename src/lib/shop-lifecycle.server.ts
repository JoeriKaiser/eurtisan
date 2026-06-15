import { and, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import { product, shop, shopOrder } from '#/db/schema'
import type { SafeUser } from './user-types'

export class ShopLifecycleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ShopLifecycleError'
  }
}

const BLOCKING_SHOP_STATUSES_FOR_DELETE = [
  'pending_review',
  'approved',
  'active',
  'suspended',
] as const
const DELETION_RETENTION_DAYS = 30

async function verifyShopOwner(shopId: string, userId: string): Promise<void> {
  const record = await db.query.shop.findFirst({
    where: eq(shop.id, shopId),
    columns: { ownerId: true },
  })
  if (!record || record.ownerId !== userId) {
    throw new ShopLifecycleError('FORBIDDEN', 'You do not have permission to manage this shop.')
  }
}

function deletionDate(): Date {
  const date = new Date()
  date.setDate(date.getDate() + DELETION_RETENTION_DAYS)
  return date
}

export async function pauseShopQuery(shopId: string, user: SafeUser): Promise<void> {
  await verifyShopOwner(shopId, user.id)

  const [record] = await db
    .select({ status: shop.status })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)
  if (!record) throw new ShopLifecycleError('NOT_FOUND', 'Shop not found.')
  if (record.status !== 'active') {
    throw new ShopLifecycleError('INVALID_STATE', 'Only active shops can be paused.')
  }

  await db
    .update(shop)
    .set({ status: 'paused', pausedAt: new Date(), updatedAt: new Date() })
    .where(eq(shop.id, shopId))
}

export async function resumeShopQuery(shopId: string, user: SafeUser): Promise<void> {
  await verifyShopOwner(shopId, user.id)

  const [record] = await db
    .select({ pausedAt: shop.pausedAt })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)
  if (!record) throw new ShopLifecycleError('NOT_FOUND', 'Shop not found.')
  if (!record.pausedAt) {
    throw new ShopLifecycleError('INVALID_STATE', 'Shop is not paused.')
  }

  await db.update(shop).set({ pausedAt: null, updatedAt: new Date() }).where(eq(shop.id, shopId))
}

export async function archiveShopQuery(shopId: string, user: SafeUser): Promise<void> {
  await verifyShopOwner(shopId, user.id)

  const [record] = await db
    .select({ status: shop.status })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)
  if (!record) throw new ShopLifecycleError('NOT_FOUND', 'Shop not found.')
  if (record.status !== 'active' && !record.status) {
    throw new ShopLifecycleError('INVALID_STATE', 'Only active shops can be archived.')
  }

  await db.transaction(async (tx) => {
    await tx
      .update(shop)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(shop.id, shopId))

    await tx
      .update(product)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(product.shopId, shopId))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        and(eq(shopOrder.shopId, shopId), inArray(shopOrder.status, ['pending_payment' as const])),
      )
  })
}

export async function requestShopDeletionQuery(shopId: string, user: SafeUser): Promise<Date> {
  await verifyShopOwner(shopId, user.id)

  const [record] = await db
    .select({ status: shop.status, scheduledDeleteAt: shop.scheduledDeleteAt })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!record) throw new ShopLifecycleError('NOT_FOUND', 'Shop not found.')
  if (record.scheduledDeleteAt) {
    return record.scheduledDeleteAt
  }

  if ((BLOCKING_SHOP_STATUSES_FOR_DELETE as unknown as readonly string[]).includes(record.status)) {
    throw new ShopLifecycleError(
      'ACTIVE_SHOP',
      'Active or pending shops cannot be deleted. Archive the shop first.',
    )
  }

  const pendingOrders = await db
    .select({ id: shopOrder.id })
    .from(shopOrder)
    .where(
      and(
        eq(shopOrder.shopId, shopId),
        inArray(shopOrder.status, [
          'pending_payment',
          'paid',
          'processing',
          'shipped',
          'delivered',
          'disputed',
          'manual_review',
        ] as const),
      ),
    )
    .limit(1)

  if (pendingOrders.length > 0) {
    throw new ShopLifecycleError(
      'OPEN_ORDERS',
      'Cannot schedule deletion while open orders exist. Resolve or cancel them first.',
    )
  }

  const scheduledAt = deletionDate()
  await db
    .update(shop)
    .set({ scheduledDeleteAt: scheduledAt, updatedAt: new Date() })
    .where(eq(shop.id, shopId))

  return scheduledAt
}

export async function cancelShopDeletionQuery(shopId: string, user: SafeUser): Promise<void> {
  await verifyShopOwner(shopId, user.id)

  await db
    .update(shop)
    .set({ scheduledDeleteAt: null, updatedAt: new Date() })
    .where(eq(shop.id, shopId))
}
