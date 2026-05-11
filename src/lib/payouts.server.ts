import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { payout, shop } from '#/db/schema'

export async function markPayoutSentQuery(payoutId: string): Promise<{ success: boolean }> {
  return db.transaction(async (tx) => {
    const [payoutRecord] = await tx.select().from(payout).where(eq(payout.id, payoutId)).limit(1)

    if (!payoutRecord) {
      throw new Response(JSON.stringify({ error: 'Not Found', message: 'Payout not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (payoutRecord.status === 'sent') {
      return { success: true }
    }

    await tx
      .update(payout)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(payout.id, payoutId))

    const shopRecord = await tx.select().from(shop).where(eq(shop.id, payoutRecord.shopId)).limit(1)

    // Create notification — errors must not break the payout transaction
    try {
      const { createNotification } = await import('./notifications.server')
      if (shopRecord[0]) {
        await createNotification(shopRecord[0].ownerId, 'payout_sent', {
          payoutId,
          shopId: payoutRecord.shopId,
          amount: String(payoutRecord.amountCents / 100),
        })
      }
    } catch {
      // swallow
    }

    return { success: true }
  })
}
