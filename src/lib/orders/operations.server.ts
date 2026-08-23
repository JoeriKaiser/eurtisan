import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { platformOrder, shopOrder } from '#/db/schema'
import { releaseStockInTx } from '../inventory.server'

export async function cancelOrderQuery(
  platformOrderId: string,
  userId: string,
): Promise<{ success: boolean }> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(platformOrder)
      .where(eq(platformOrder.id, platformOrderId))
      .for('update')
      .limit(1)

    if (!order || order.userId !== userId) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (order.status !== 'pending_payment') {
      throw new Response(
        JSON.stringify({ error: 'Conflict', message: 'Order cannot be cancelled' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Sequential within transaction: the PostgreSQL driver does not support concurrent
    // queries on the same transaction connection, and stock release must run after the
    // order rows are updated.
    await tx
      .update(platformOrder)
      .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
      .where(eq(platformOrder.id, platformOrderId))

    await tx
      .update(shopOrder)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(shopOrder.platformOrderId, platformOrderId))

    await releaseStockInTx(tx, platformOrderId)

    return { success: true }
  })
}
