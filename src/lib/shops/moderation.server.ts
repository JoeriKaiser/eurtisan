import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '#/db/index'
import { meilisearchSyncQueue, product, shop, user } from '#/db/schema'
import { validatePlainText } from '../xss'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type SuspensionFilter = 'suspended' | 'active' | 'all'
export type ShopSortColumn = 'name' | 'createdAt' | 'status'

export interface ShopListItem {
  id: string
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
  status: string
  isSuspended: boolean
  moderationNote: string | null
  createdAt: Date
}

export interface PaginatedShops {
  shops: ShopListItem[]
  total: number
  page: number
  pageSize: number
}

/* -------------------------------------------------------------------------- */
/*                            List All Shops Query                            */
/* -------------------------------------------------------------------------- */

/**
 * Returns a paginated list of all shops with owner details.
 * Supports filtering by suspension status, searching by name/slug/owner email,
 * and sorting by name, createdAt, or status.
 */
export async function listAllShopsQuery(params: {
  filter: SuspensionFilter
  query?: string
  sortBy?: ShopSortColumn
  sortDir?: 'asc' | 'desc'
  page: number
  pageSize: number
}): Promise<PaginatedShops> {
  const { filter, query, sortBy = 'createdAt', sortDir = 'desc', page, pageSize } = params
  const offset = (page - 1) * pageSize

  const conditions = []

  switch (filter) {
    case 'suspended':
      conditions.push(eq(shop.isSuspended, true))
      break
    case 'active':
      conditions.push(eq(shop.isSuspended, false))
      break
  }

  if (query) {
    const pattern = `%${query}%`
    conditions.push(
      or(
        ilike(shop.name, pattern),
        ilike(shop.slug, pattern),
        ilike(user.email, pattern),
        ilike(user.name, pattern),
      ),
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const orderBy = (() => {
    const dir = sortDir === 'asc' ? 'asc' : 'desc'
    switch (sortBy) {
      case 'name':
        return dir === 'asc' ? shop.name : desc(shop.name)
      case 'status':
        return dir === 'asc' ? shop.status : desc(shop.status)
      default:
        return dir === 'asc' ? shop.createdAt : desc(shop.createdAt)
    }
  })()

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        ownerName: user.name,
        ownerEmail: user.email,
        status: shop.status,
        isSuspended: shop.isSuspended,
        moderationNote: shop.moderationNote,
        createdAt: shop.createdAt,
      })
      .from(shop)
      .innerJoin(user, eq(shop.ownerId, user.id))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(shop)
      .innerJoin(user, eq(shop.ownerId, user.id))
      .where(where),
  ])

  return {
    shops: rows,
    total: Number(totalResult[0]?.count ?? 0),
    page,
    pageSize,
  }
}

/* -------------------------------------------------------------------------- */
/*                           Moderate Shop Query                              */
/* -------------------------------------------------------------------------- */

export type ModerateAction = 'suspend' | 'unsuspend'

export interface ModerateShopResult {
  id: string
  name: string
  isSuspended: boolean
  moderationNote: string | null
}

/**
 * Suspends or unsuspends a shop, optionally setting a moderation note.
 *
 * - When `note` is provided, it overwrites the existing moderation note.
 * - When `note` is undefined, the existing moderation note is left unchanged.
 * - Suspending an already-suspended shop or unsuspending an already-active
 *   shop is idempotent — it succeeds without error.
 * - Returns the updated shop fields, or throws if the shop does not exist.
 */
export async function moderateShopQuery(
  shopId: string,
  action: ModerateAction,
  note?: string,
): Promise<ModerateShopResult> {
  const isSuspended = action === 'suspend'

  // Verify the shop exists.
  const [shopRecord] = await db
    .select({ id: shop.id, name: shop.name, isSuspended: shop.isSuspended })
    .from(shop)
    .where(eq(shop.id, shopId))
    .limit(1)

  if (!shopRecord) {
    throw new Error(`Shop not found: ${shopId}`)
  }

  // Build update payload.
  const updateData: Record<string, unknown> = {
    isSuspended,
    updatedAt: new Date(),
  }

  // Only set moderation note when explicitly provided.
  // `undefined` means "don't touch it", `null` or `""` means "clear it".
  if (note !== undefined) {
    updateData.moderationNote = note ? validatePlainText(note, 'Moderation note') : null
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(shop).set(updateData).where(eq(shop.id, shopId)).returning({
      id: shop.id,
      name: shop.name,
      isSuspended: shop.isSuspended,
      moderationNote: shop.moderationNote,
    })

    // Suspension state is part of the search index invariant, but the index is
    // a separate store that nothing here would otherwise update — a suspended
    // shop's listings would stay searchable until something happened to
    // re-index them. Enqueue rather than calling Meilisearch inline so the
    // moderation action cannot fail on a search outage.
    //
    // `index` is correct in both directions: the sync worker re-evaluates
    // eligibility and removes the document when the shop is suspended, or
    // restores it when the suspension is lifted.
    const products = await tx
      .select({ id: product.id })
      .from(product)
      .where(eq(product.shopId, shopId))

    if (products.length > 0) {
      await tx.insert(meilisearchSyncQueue).values(
        products.map((row) => ({
          productId: row.id,
          action: 'index' as const,
        })),
      )
    }

    return rows
  })

  return updated
}
