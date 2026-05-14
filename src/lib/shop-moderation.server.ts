import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { shop, user } from '#/db/schema'

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type SuspensionFilter = 'suspended' | 'active' | 'all'

export interface ShopListItem {
  id: string
  name: string
  slug: string
  ownerName: string
  ownerEmail: string
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
 * Results are sorted by createdAt descending (newest first).
 */
export async function listAllShopsQuery(params: {
  filter: SuspensionFilter
  page: number
  pageSize: number
}): Promise<PaginatedShops> {
  const { filter, page, pageSize } = params
  const offset = (page - 1) * pageSize

  const filterCondition = (() => {
    switch (filter) {
      case 'suspended':
        return eq(shop.isSuspended, true)
      case 'active':
        return eq(shop.isSuspended, false)
      case 'all':
        return undefined
    }
  })()

  const where = filterCondition ? and(filterCondition) : undefined

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        ownerName: user.name,
        ownerEmail: user.email,
        isSuspended: shop.isSuspended,
        moderationNote: shop.moderationNote,
        createdAt: shop.createdAt,
      })
      .from(shop)
      .innerJoin(user, eq(shop.ownerId, user.id))
      .where(where)
      .orderBy(desc(shop.createdAt))
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
    updateData.moderationNote = note || null
  }

  const [updated] = await db.update(shop).set(updateData).where(eq(shop.id, shopId)).returning({
    id: shop.id,
    name: shop.name,
    isSuspended: shop.isSuspended,
    moderationNote: shop.moderationNote,
  })

  return updated
}
