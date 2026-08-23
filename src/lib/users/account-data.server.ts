import { eq, inArray, or, sql } from 'drizzle-orm'

import { db } from '#/db/index'
import {
  account,
  auditLog,
  cart,
  cartItem,
  customerNote,
  customerTag,
  dispute,
  disputeMessage,
  guestOrderAccess,
  invoices,
  notification,
  ownerMessage,
  ownerMessageThread,
  payout,
  payoutReconciliationLog,
  platformOrder,
  product,
  returnRequest,
  returnRequestMessage,
  review,
  session,
  shippingLabel,
  shop,
  shopOrder,
  twoFactor,
  user,
  userEmailPreference,
  userNotificationPreference,
} from '#/db/schema'
import { hashEmail } from '#/lib/customers.server'
import { deletePendingOutboxRowsForUser } from '#/lib/email-outbox.server'
import { decryptJsonb, encryptJsonb } from '#/lib/encryption.server'
import type { SerializableValue } from '../notifications.server'

const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.eurtisan.invalid'

export interface UserDataExport {
  exportedAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
    emailVerified: boolean
    createdAt: string
    updatedAt: string
  }
  shops: Array<{
    id: string
    name: string
    slug: string
    status: string
    createdAt: string
  }>
  platformOrders: Array<{
    id: string
    status: string
    totalCents: number
    createdAt: string
    shippingAddress: SerializableValue
    billingAddress: SerializableValue
  }>
  shopOrders: Array<{
    id: string
    platformOrderId: string
    shopId: string
    status: string
    subtotalCents: number
    shippingCostCents: number
    totalCents: number
    createdAt: string
  }>
  invoices: {
    asBuyer: Array<{
      id: string
      invoiceNumber: string
      type: string
      shopOrderId: string
      subtotalCents: number
      vatAmountCents: number
      totalCents: number
      billingDetails: SerializableValue
      createdAt: string
    }>
    asSeller: Array<{
      id: string
      invoiceNumber: string
      type: string
      shopOrderId: string
      subtotalCents: number
      vatAmountCents: number
      totalCents: number
      billingDetails: SerializableValue
      createdAt: string
    }>
  }
  messages: {
    ownerThreads: Array<{
      id: string
      shopId: string
      subject: string
      createdAt: string
      updatedAt: string
      messages: Array<{
        id: string
        senderRole: string
        body: string
        createdAt: string
      }>
    }>
    disputeMessages: Array<{
      id: string
      disputeId: string
      message: string
      createdAt: string
    }>
  }
  disputes: Array<{
    id: string
    shopOrderId: string
    reason: string
    description: string
    status: string
    createdAt: string
  }>
  returns: Array<{
    id: string
    shopOrderId: string
    type: string
    status: string
    reason: string
    refundCents: number
    trackingNumber: string | null
    createdAt: string
    messages: Array<{ id: string; message: string; createdAt: string }>
  }>
  reviews: Array<{
    id: string
    productId: string
    rating: number
    comment: string | null
    createdAt: string
  }>
  notifications: Array<{
    id: string
    type: string
    data: SerializableValue
    groupKey: string | null
    readAt: string | null
    createdAt: string
  }>
  auditLogs: Array<{
    id: string
    action: string
    resourceType: string
    resourceId: string | null
    metadata: SerializableValue
    createdAt: string
  }>
  emailPreferences: Array<{
    id: string
    category: string
    enabled: boolean
    createdAt: string
    updatedAt: string
  }>
  notificationPreferences: Array<{
    id: string
    type: string
    enabled: boolean
    createdAt: string
    updatedAt: string
  }>
  customerNotes: Array<{
    id: string
    shopId: string
    content: string
    createdAt: string
    updatedAt: string
  }>
  customerTags: Array<{
    id: string
    shopId: string
    tag: string
    createdAt: string
  }>
}

function redactedAddress(): Record<string, string> {
  return {
    name: 'Deleted User',
    street: '[redacted]',
    city: '[redacted]',
    postalCode: '[redacted]',
    country: 'XX',
  }
}

function redactCounterpartyBillingDetails(
  billingDetails: unknown,
  party: 'from' | 'to',
): SerializableValue {
  if (billingDetails === null || typeof billingDetails !== 'object') {
    return billingDetails as SerializableValue
  }

  const details = { ...(billingDetails as Record<string, unknown>) }
  const counterparty = party === 'from' ? 'to' : 'from'
  const counterpartyValue = details[counterparty]
  const counterpartyName =
    counterpartyValue !== null &&
    typeof counterpartyValue === 'object' &&
    !Array.isArray(counterpartyValue)
      ? (((counterpartyValue as Record<string, unknown>).name as string | undefined) ??
        '[redacted]')
      : '[redacted]'

  details[counterparty] = { name: counterpartyName }
  return details as SerializableValue
}

const PAYOUT_PAYLOAD_PII_KEYS = new Set([
  'buyerName',
  'buyerEmail',
  'address',
  'shippingAddress',
  'billingAddress',
  'name',
  'email',
])

function redactPayoutPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') {
    return payload
  }

  if (Array.isArray(payload)) {
    return payload.map(redactPayoutPayload)
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (PAYOUT_PAYLOAD_PII_KEYS.has(key)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = redactedAddress()
      } else {
        result[key] = '[redacted]'
      }
    } else if (typeof value === 'object') {
      result[key] = redactPayoutPayload(value)
    } else {
      result[key] = value
    }
  }
  return result
}

export async function exportUserData(userId: string): Promise<UserDataExport> {
  const [profile] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!profile || profile.deletedAt) {
    throw new Error('USER_NOT_FOUND')
  }

  const emailHash = hashEmail(profile.email)

  const [
    shops,
    platformOrders,
    shopOrdersAsBuyer,
    shopOrdersAsSeller,
    reviews,
    disputes,
    notifications,
    ownerThreads,
    disputeMessages,
    auditLogsRows,
    emailPreferences,
    notificationPreferences,
    customerNotes,
    customerTags,
    invoicesAsBuyer,
    invoicesAsSeller,
  ] = await Promise.all([
    db.select().from(shop).where(eq(shop.ownerId, userId)),
    db.select().from(platformOrder).where(eq(platformOrder.userId, userId)),
    db
      .select({
        id: shopOrder.id,
        platformOrderId: shopOrder.platformOrderId,
        shopId: shopOrder.shopId,
        status: shopOrder.status,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        vatAmountCents: shopOrder.vatAmountCents,
        shippingVatAmountCents: shopOrder.shippingVatAmountCents,
        createdAt: shopOrder.createdAt,
      })
      .from(shopOrder)
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .where(eq(platformOrder.userId, userId)),
    db
      .select({
        id: shopOrder.id,
        platformOrderId: shopOrder.platformOrderId,
        shopId: shopOrder.shopId,
        status: shopOrder.status,
        subtotalCents: shopOrder.subtotalCents,
        shippingCostCents: shopOrder.shippingCostCents,
        vatAmountCents: shopOrder.vatAmountCents,
        shippingVatAmountCents: shopOrder.shippingVatAmountCents,
        createdAt: shopOrder.createdAt,
      })
      .from(shopOrder)
      .innerJoin(shop, eq(shopOrder.shopId, shop.id))
      .where(eq(shop.ownerId, userId)),
    db.select().from(review).where(eq(review.buyerUserId, userId)),
    db.select().from(dispute).where(eq(dispute.buyerUserId, userId)),
    db.select().from(notification).where(eq(notification.userId, userId)),
    db
      .select()
      .from(ownerMessageThread)
      .where(
        or(
          eq(ownerMessageThread.customerUserId, userId),
          eq(ownerMessageThread.customerEmailHash, emailHash),
        ),
      ),
    db
      .select({
        disputeMessageId: disputeMessage.id,
        disputeId: disputeMessage.disputeId,
        message: disputeMessage.message,
        disputeMessageCreatedAt: disputeMessage.createdAt,
      })
      .from(disputeMessage)
      .where(eq(disputeMessage.senderUserId, userId)),
    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.actorId, userId)),
    db.select().from(userEmailPreference).where(eq(userEmailPreference.userId, userId)),
    db
      .select()
      .from(userNotificationPreference)
      .where(eq(userNotificationPreference.userId, userId)),
    db.select().from(customerNote).where(eq(customerNote.customerEmailHash, emailHash)),
    db.select().from(customerTag).where(eq(customerTag.customerEmailHash, emailHash)),
    db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.type,
        invoiceShopOrderId: invoices.shopOrderId,
        invoiceSubtotalCents: invoices.subtotalCents,
        invoiceVatAmountCents: invoices.vatAmountCents,
        invoiceTotalCents: invoices.totalCents,
        invoiceBillingDetails: invoices.billingDetails,
        invoiceCreatedAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .where(eq(platformOrder.userId, userId)),
    db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceType: invoices.type,
        invoiceShopOrderId: invoices.shopOrderId,
        invoiceSubtotalCents: invoices.subtotalCents,
        invoiceVatAmountCents: invoices.vatAmountCents,
        invoiceTotalCents: invoices.totalCents,
        invoiceBillingDetails: invoices.billingDetails,
        invoiceCreatedAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
      .innerJoin(shop, eq(shopOrder.shopId, shop.id))
      .where(eq(shop.ownerId, userId)),
  ])

  const threadIds = ownerThreads.map((thread) => thread.id)
  const ownerMessages =
    threadIds.length > 0
      ? await db.select().from(ownerMessage).where(inArray(ownerMessage.threadId, threadIds))
      : []

  const messagesByThread = new Map<string, typeof ownerMessages>()
  for (const message of ownerMessages) {
    const list = messagesByThread.get(message.threadId) ?? []
    list.push(message)
    messagesByThread.set(message.threadId, list)
  }

  const returnRows = await db
    .select()
    .from(returnRequest)
    .where(eq(returnRequest.buyerUserId, userId))
  const returnMessages =
    returnRows.length > 0
      ? await db
          .select()
          .from(returnRequestMessage)
          .where(
            inArray(
              returnRequestMessage.returnRequestId,
              returnRows.map((row) => row.id),
            ),
          )
      : []

  const allShopOrders = [
    ...shopOrdersAsBuyer.map((order) => ({
      ...order,
      totalCents:
        order.subtotalCents +
        order.shippingCostCents +
        order.vatAmountCents +
        order.shippingVatAmountCents,
    })),
    ...shopOrdersAsSeller.map((order) => ({
      ...order,
      totalCents:
        order.subtotalCents +
        order.shippingCostCents +
        order.vatAmountCents +
        order.shippingVatAmountCents,
    })),
  ].filter((order, index, self) => self.findIndex((o) => o.id === order.id) === index)

  const asBuyerInvoiceIds = new Set(invoicesAsBuyer.map((invoice) => invoice.invoiceId))
  const deduplicatedSellerInvoices = invoicesAsSeller.filter(
    (invoice) => !asBuyerInvoiceIds.has(invoice.invoiceId),
  )

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      emailVerified: profile.emailVerified,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    shops: shops.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
    platformOrders: platformOrders.map((o) => ({
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
      shippingAddress: decryptJsonb(o.shippingAddress) as SerializableValue,
      billingAddress: decryptJsonb(o.billingAddress) as SerializableValue,
    })),
    shopOrders: allShopOrders.map((o) => ({
      id: o.id,
      platformOrderId: o.platformOrderId,
      shopId: o.shopId,
      status: o.status,
      subtotalCents: o.subtotalCents,
      shippingCostCents: o.shippingCostCents,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
    })),
    invoices: {
      asBuyer: invoicesAsBuyer.map((invoice) => ({
        id: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.invoiceType,
        shopOrderId: invoice.invoiceShopOrderId,
        subtotalCents: invoice.invoiceSubtotalCents,
        vatAmountCents: invoice.invoiceVatAmountCents,
        totalCents: invoice.invoiceTotalCents,
        billingDetails: redactCounterpartyBillingDetails(
          decryptJsonb(invoice.invoiceBillingDetails),
          'to',
        ),
        createdAt: invoice.invoiceCreatedAt.toISOString(),
      })),
      asSeller: deduplicatedSellerInvoices.map((invoice) => ({
        id: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        type: invoice.invoiceType,
        shopOrderId: invoice.invoiceShopOrderId,
        subtotalCents: invoice.invoiceSubtotalCents,
        vatAmountCents: invoice.invoiceVatAmountCents,
        totalCents: invoice.invoiceTotalCents,
        billingDetails: redactCounterpartyBillingDetails(
          decryptJsonb(invoice.invoiceBillingDetails),
          'from',
        ),
        createdAt: invoice.invoiceCreatedAt.toISOString(),
      })),
    },
    messages: {
      ownerThreads: ownerThreads.map((thread) => ({
        id: thread.id,
        shopId: thread.shopId,
        subject: thread.subject,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messages:
          messagesByThread.get(thread.id)?.map((message) => ({
            id: message.id,
            senderRole: message.senderRole,
            body: message.body,
            createdAt: message.createdAt.toISOString(),
          })) ?? [],
      })),
      disputeMessages: disputeMessages.map((message) => ({
        id: message.disputeMessageId,
        disputeId: message.disputeId,
        message: message.message,
        createdAt: message.disputeMessageCreatedAt.toISOString(),
      })),
    },
    disputes: disputes.map((d) => ({
      id: d.id,
      shopOrderId: d.shopOrderId,
      reason: d.reason,
      description: d.description,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
    returns: returnRows.map((request) => ({
      id: request.id,
      shopOrderId: request.shopOrderId,
      type: request.type,
      status: request.status,
      reason: request.reason,
      refundCents: request.refundCents,
      trackingNumber: request.trackingNumber,
      createdAt: request.createdAt.toISOString(),
      messages: returnMessages
        .filter((message) => message.returnRequestId === request.id)
        .map((message) => ({
          id: message.id,
          message: message.message,
          createdAt: message.createdAt.toISOString(),
        })),
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      productId: r.productId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      data: n.data as SerializableValue,
      groupKey: n.groupKey,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    auditLogs: auditLogsRows.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      metadata: log.metadata as SerializableValue,
      createdAt: log.createdAt.toISOString(),
    })),
    emailPreferences: emailPreferences.map((preference) => ({
      id: preference.id,
      category: preference.category,
      enabled: preference.enabled,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    })),
    notificationPreferences: notificationPreferences.map((preference) => ({
      id: preference.id,
      type: preference.type,
      enabled: preference.enabled,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    })),
    customerNotes: customerNotes.map((note) => ({
      id: note.id,
      shopId: note.shopId,
      content: note.content,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
    customerTags: customerTags.map((tag) => ({
      id: tag.id,
      shopId: tag.shopId,
      tag: tag.tag,
      createdAt: tag.createdAt.toISOString(),
    })),
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const [profile] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!profile || profile.deletedAt) {
    throw new Error('USER_NOT_FOUND')
  }

  if (profile.role === 'admin') {
    throw new Error('ADMIN_DELETE_FORBIDDEN')
  }

  const ownedShops = await db
    .select({ id: shop.id, status: shop.status })
    .from(shop)
    .where(eq(shop.ownerId, userId))

  const ownedShopIds = ownedShops.map((s) => s.id)
  const anonymizedEmail = `deleted-${userId}@${ANONYMIZED_EMAIL_DOMAIN}`
  const redacted = redactedAddress()
  // Derived while the real email is still readable; the update below replaces it.
  const emailHash = hashEmail(profile.email)

  await db.transaction(async (tx) => {
    if (ownedShopIds.length > 0) {
      // Forced system transition: account deletion archives all owned shops
      // regardless of their current lifecycle status. This bypasses the normal
      // isValidShopStatusTransition helper because deletion is a compliance
      // operation and must always succeed.
      await tx
        .update(shop)
        .set({
          status: 'archived',
          archivedAt: new Date(),
          scheduledDeleteAt: null,
          businessAddress: encryptJsonb(redacted),
          shippingOrigin: encryptJsonb(redacted),
          updatedAt: new Date(),
        })
        .where(inArray(shop.id, ownedShopIds))

      await tx
        .update(product)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(product.shopId, ownedShopIds))
    }

    const userOrders = await tx
      .select({ id: platformOrder.id })
      .from(platformOrder)
      .where(eq(platformOrder.userId, userId))

    for (const order of userOrders) {
      await tx
        .update(platformOrder)
        .set({
          shippingAddress: encryptJsonb(redacted),
          billingAddress: encryptJsonb(redacted),
          buyerEmail: null,
          buyerEmailHash: null,
          isGuest: false,
          updatedAt: new Date(),
        })
        .where(eq(platformOrder.id, order.id))
    }

    if (userOrders.length > 0) {
      await tx.delete(guestOrderAccess).where(
        inArray(
          guestOrderAccess.platformOrderId,
          userOrders.map((order) => order.id),
        ),
      )
    }

    await tx.update(review).set({ comment: null }).where(eq(review.buyerUserId, userId))

    const userDisputeIds = await tx
      .select({ id: dispute.id })
      .from(dispute)
      .where(eq(dispute.buyerUserId, userId))

    if (userDisputeIds.length > 0) {
      await tx
        .update(dispute)
        .set({ description: '[redacted — account deleted]', updatedAt: new Date() })
        .where(eq(dispute.buyerUserId, userId))
    }

    await tx.delete(notification).where(eq(notification.userId, userId))

    const userCarts = await tx.select({ id: cart.id }).from(cart).where(eq(cart.userId, userId))
    if (userCarts.length > 0) {
      const cartIds = userCarts.map((c) => c.id)
      await tx.delete(cartItem).where(inArray(cartItem.cartId, cartIds))
      await tx.delete(cart).where(inArray(cart.id, cartIds))
    }

    await tx
      .update(disputeMessage)
      .set({ message: '[message removed — account deleted]' })
      .where(eq(disputeMessage.senderUserId, userId))

    await tx
      .update(returnRequest)
      .set({ reason: '[redacted — account deleted]', updatedAt: new Date() })
      .where(eq(returnRequest.buyerUserId, userId))
    await tx
      .update(returnRequestMessage)
      .set({ message: '[message removed — account deleted]' })
      .where(eq(returnRequestMessage.senderUserId, userId))

    // Shop-owner CRM records about this person. Free-text notes are pure
    // buyer PII; tags carry no independent value once the person is gone.
    await tx
      .update(customerNote)
      .set({ content: '[REDACTED]', updatedAt: new Date() })
      .where(eq(customerNote.customerEmailHash, emailHash))

    await tx.delete(customerTag).where(eq(customerTag.customerEmailHash, emailHash))

    // Threads match either the account id or the pre-anonymization email
    // hash, so guests who checked out without registering are covered too.
    const customerThreadIds = await tx
      .select({ id: ownerMessageThread.id })
      .from(ownerMessageThread)
      .where(
        or(
          eq(ownerMessageThread.customerUserId, userId),
          eq(ownerMessageThread.customerEmailHash, emailHash),
        ),
      )

    if (customerThreadIds.length > 0) {
      const threadIds = customerThreadIds.map((t) => t.id)
      await tx
        .update(ownerMessage)
        .set({ body: '[REDACTED]' })
        .where(inArray(ownerMessage.threadId, threadIds))
      await tx
        .update(ownerMessageThread)
        .set({ subject: '[REDACTED]', updatedAt: new Date() })
        .where(inArray(ownerMessageThread.id, threadIds))
    }

    const ownedShopInvoiceIds = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
      .where(inArray(shopOrder.shopId, ownedShopIds))

    for (const invoice of ownedShopInvoiceIds) {
      await tx
        .update(invoices)
        .set({ billingDetails: encryptJsonb(redacted) })
        .where(eq(invoices.id, invoice.id))
    }

    const buyerInvoiceIds = await tx
      .select({ id: invoices.id })
      .from(invoices)
      .innerJoin(shopOrder, eq(invoices.shopOrderId, shopOrder.id))
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .where(eq(platformOrder.userId, userId))

    for (const invoice of buyerInvoiceIds) {
      await tx
        .update(invoices)
        .set({ billingDetails: encryptJsonb(redacted) })
        .where(eq(invoices.id, invoice.id))
    }

    // Shipping labels hold no PII directly, but `labelUrl` resolves — with
    // carrier credentials — to a PDF bearing the buyer's name and address, and
    // the tracking identifiers are carrier-side handles to the same shipment.
    // The document itself lives at Sendcloud and is subject to their retention,
    // so what we can erase is our resolvable pointer to it. The row survives
    // because the seller's fulfilment record legitimately outlives the buyer's
    // account, exactly as invoices do above.
    const buyerShippingLabelIds = await tx
      .select({ id: shippingLabel.id })
      .from(shippingLabel)
      .innerJoin(shopOrder, eq(shippingLabel.shopOrderId, shopOrder.id))
      .innerJoin(platformOrder, eq(shopOrder.platformOrderId, platformOrder.id))
      .where(eq(platformOrder.userId, userId))

    for (const label of buyerShippingLabelIds) {
      await tx
        .update(shippingLabel)
        .set({ labelUrl: null, trackingNumber: null, externalParcelId: null })
        .where(eq(shippingLabel.id, label.id))
    }

    const ownedPayoutLogRows = await tx
      .select({ id: payoutReconciliationLog.id, payload: payoutReconciliationLog.payload })
      .from(payoutReconciliationLog)
      .innerJoin(payout, eq(payoutReconciliationLog.payoutId, payout.id))
      .where(inArray(payout.shopId, ownedShopIds))

    for (const logRow of ownedPayoutLogRows) {
      await tx
        .update(payoutReconciliationLog)
        .set({ payload: redactPayoutPayload(logRow.payload) })
        .where(eq(payoutReconciliationLog.id, logRow.id))
    }

    await tx
      .update(auditLog)
      .set({ actorName: 'Deleted User', actorId: sql`NULL` })
      .where(eq(auditLog.actorId, userId))

    await tx.delete(session).where(eq(session.userId, userId))
    await tx.delete(account).where(eq(account.userId, userId))
    await tx.delete(twoFactor).where(eq(twoFactor.userId, userId))
    await tx.delete(userEmailPreference).where(eq(userEmailPreference.userId, userId))
    await tx.delete(userNotificationPreference).where(eq(userNotificationPreference.userId, userId))

    // Delete pending emails before anonymizing the address. The CASCADE on
    // userId would remove them after the update, but explicit deletion is
    // safer and avoids sending to an anonymized address.
    await deletePendingOutboxRowsForUser(userId, tx)

    await tx
      .update(user)
      .set({
        name: 'Deleted User',
        email: anonymizedEmail,
        image: null,
        emailVerified: false,
        twoFactorEnabled: false,
        unsubscribeToken: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
  })
}
