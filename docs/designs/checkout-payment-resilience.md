# Resilient & Idempotent Checkout Payment Handoff

*   **Author:** Joeri & omp
*   **Status:** Draft
*   **Date:** 2026-10-31

--------------------------------------------------------------------------------

## Overview

Eurtisan is a European marketplace connecting independent artisans with buyers. In any distance-sale marketplace, the checkout payment handoff is the critical operational junction between cart persistence, inventory reservation, and external payment settlement.

Currently, the payment handoff between PostgreSQL order persistence and Mollie payment processing contains unhandled failure modes and conflicting state assumptions:
1. When external payment initiation fails, the buyer's cart has already been deleted, leaving an unpaid order in the database while presenting the buyer with an unrecoverable failure.
2. Webhook cancellations mark the platform order `cancelled` while a 15-minute stock hold is still active, but the retry endpoint rejects any order not in `pending_payment`, locking the buyer out of retrying payment on their held items.
3. If a buyer attempts to rebuild their cart from a cancelled order, the order's own active reservation blocks stock validation for single-unit handmade products, causing the rebuild to fail and emptying the cart.
4. On asynchronous European payment rails (such as iDEAL or Bancontact), if an initial payment settles after a retry was initiated, the secondary capture is silently dropped as already processed, capturing buyer funds with no order fulfillment and no automated refund.
5. Rapid double-clicks on the checkout submission button trigger unhandled database unique constraint violations (code 23505) and launch competing payment sessions.

This document establishes the architectural specification to harden the checkout handoff, enforce strict idempotency, decouple external payment session churn from top-level order lifecycle rules, and provide unified recovery workflows for buyers.

--------------------------------------------------------------------------------

## Problem Statement

The checkout handoff has five failure modes:

1. **Cart Deletion before Payment Handoff:**
   `persistCheckoutOrder` deletes the cart and line items inside the transaction that creates the platform order. When the subsequent call to `initiateCheckoutPayment` encounters gateway timeouts or network errors, it returns null. The buyer is redirected to a confirmation page that renders an unbounded loading indicator ("Confirming payment..."), polling for 5 minutes without resolution. The buyer's cart is deleted, and they cannot restart checkout.

2. **Terminal State Invariant Contradiction:**
   `cancelPendingOrder` in webhook reconciliation immediately transitions the platform order to `status: 'cancelled'` upon receiving a provider cancellation or expiration webhook. However, the 15-minute inventory reservation remains active. When the buyer returns to the platform and clicks "Retry payment", `retryPayment` rejects the request because `order.status !== 'pending_payment'`. Attempting to reopen cancelled orders back to `pending_payment` violates the domain rule that `cancelled` is an irreversible terminal state, corrupts audit timestamps, and causes reconciliation workers to issue unintended refunds against new payments.

3. **Inventory Reservation Self-Deadlock in Cart Rebuilds:**
   When an order is cancelled with an active reservation, the UI presents a "Rebuild cart" action. `rebuildCartFromOrderQuery` calls `addItemToCart`, which computes available stock by subtracting all unexpired reservations. Because the order's reservation is unexpired, it blocks stock availability for unique, single-stock artisan items. The rebuild operation fails, clears the cart, and redirects the buyer with a confusing "stock changed" notice.

4. **Silent Dropping of Captured Customer Funds:**
   When a buyer triggers a retry for a slow payment session, both attempts can eventually be paid. In `reconcileMolliePayment`, when a webhook arrives for an order that is already marked `paid` with a different payment ID, the event is silently ignored as `already_processed`. The platform captures the buyer's money twice with zero ledger record, no refund, and no automated alert.

5. **Concurrency Violations on Submission Attempt Collisions:**
   The uniqueness check on `checkoutAttemptId` occurs via an uncommitted `SELECT` prior to entering `persistCheckoutOrder`. Concurrent submissions bypass the check, and the second request aborts with an unhandled unique constraint violation on `platform_order_checkout_attempt_id_unique` (code 23505). If retried blindly, concurrent requests launch duplicate Mollie sessions, racing to overwrite `molliePaymentId` and triggering provider rate limits.

--------------------------------------------------------------------------------

## Goals

*   **Preserve Order Terminal Invariants:** Keep `platformOrder.status` in `pending_payment` while its 15-minute inventory reservation is active. Record external gateway cancellations and expirations by retaining the order in `pending_payment` rather than prematurely cancelling the order.
*   **Deterministic Idempotency:** Catch PostgreSQL `23505` collisions on `checkoutAttemptId` at the persistence layer, retrieve the existing order, and reuse the active payment URL without launching duplicate Mollie sessions.
*   **Automatic Duplicate Capture Refunds:** Detect and automatically refund secondary payment captures when multiple payment attempts settle for the same order, emitting high-priority alerts.
*   **Eliminate Cart Rebuild Deadlocks:** Rebuild carts strictly post-expiry or post-cancellation, treating active rebuilds as explicit order abandonment with inventory release via `releaseStockInTx`.
*   **Unified Recovery Interface:** Provide identical, actionable recovery controls ("Retry Payment" while stock is held, "Rebuild Cart" once expired) with live reservation countdown timers across both `OrderSuccessPage` and `BuyerOrderDetailPage`.
*   **Remove Navigation Dead Ends:** Eliminate the 5-minute route redirect in `orders.$platformOrderId.success.tsx` that leaves buyers on order detail views without retry controls.
*   **Observable Payment Metrics:** Instrument Prometheus metrics and structured logging for attempt collisions, duplicate capture refunds, and payment gateway retry errors.

--------------------------------------------------------------------------------

## Non-Goals

*   Redesigning cart layout, item management, or checkout address forms.
*   Supporting non-EUR currencies or multi-currency pricing models.
*   Changing the 15-minute duration of inventory stock reservations.
*   Integrating alternative payment gateways beyond Mollie.
*   Building distributed message queues or Redis-based locks for checkout submissions.

--------------------------------------------------------------------------------

## Open Questions

None. All architectural parameters are defined within this specification.

--------------------------------------------------------------------------------

## Critical User Journeys (CUJs)

### CUJ 1: Payment Provider Initiation Failure During Checkout

*   **Given:** A buyer with a populated cart submits valid shipping and billing details.
*   **When:** The database transaction commits the platform order and reserves inventory for 15 minutes, but the immediate call to `initiateCheckoutPayment` times out or returns an HTTP 5xx error from Mollie.
*   **Then:** The checkout submission catches the gateway failure and directs the buyer to the order recovery view. The UI clearly states that the payment session could not be started, displays a 15-minute reservation countdown timer, and offers an immediate "Retry payment" button. The buyer's reserved items remain protected.

### CUJ 2: Payment Cancelled on Hosted Gateway with Valid Reservation

*   **Given:** A buyer is redirected to Mollie's hosted checkout screen but decides to cancel or choose a different payment method, returning to Eurtisan.
*   **When:** Mollie's cancellation webhook arrives at `/api/webhooks/mollie` while 12 minutes remain on the order's inventory reservation.
*   **Then:** The webhook verifies that the inventory reservation remains active. The platform order remains in status `pending_payment`, and child shop orders remain in `pending_payment`. When the buyer lands on the order confirmation or order detail page, the UI informs them that payment was not completed and presents an active "Retry payment" action. Clicking retry marks the prior attempt as `superseded` and generates a fresh payment session without re-entering checkout details.

### CUJ 3: Concurrent Double-Submit on Place Order Button

*   **Given:** A buyer on a mobile connection taps the "Place order" button twice in rapid succession (< 100ms apart), sending two HTTP requests with the identical `checkoutAttemptId`.
*   **When:** Request 1 enters `persistCheckoutOrder` and commits the order. Request 2 encounters a PostgreSQL `23505` unique violation on `platform_order_checkout_attempt_id_unique`.
*   **Then:** Request 2 catches the `23505` error and queries the committed order by `checkoutAttemptId`. If a completed payment attempt exists, it decrypts and returns the existing checkout URL; otherwise, it returns `{ platformOrderId: order.id, checkoutUrl: null, paymentInitiationFailed: false, reservationExpiresAt: ... }`. The buyer is redirected to the confirmation route where client-side query polling seamlessly awaits payment initiation without unhandled 500 errors.

### CUJ 4: Cart Rebuild Following Reservation Expiry

*   **Given:** A buyer's payment fails or is cancelled, and the buyer returns after the 15-minute inventory reservation has expired.
*   **When:** The buyer views the order on either `OrderSuccessPage` or `BuyerOrderDetailPage`.
*   **Then:** The UI indicates that the reservation has expired and replaces the "Retry payment" action with "Rebuild cart". Clicking the button transfers the order's items into an active cart (re-verifying stock availability, which automatically excludes expired reservations) and routes the buyer directly to checkout with their previously entered shipping and billing addresses pre-filled.

--------------------------------------------------------------------------------

## Proposed Architecture

### 1. Decoupled Gateway Sessions and Order Domain Lifecycles

The platform order lifecycle must remain decoupled from external payment provider session states. The state machine enforces `cancelled` as an irreversible terminal state. An order must not transition to `cancelled` while its 15-minute `inventory_reservation` remains active.

```text
Payment Attempt Lifecycle (Database Constraint Compliant):
  [initiating] ---> [completed] ---> [superseded] (Replaced by newer retry attempt)

Platform Order Lifecycle (Domain State):
  [pending_payment] -----------------------------> [paid] (Authoritative capture)
          |
          | (Only when inventory_reservation expires at 15 minutes,
          |  or explicit user/admin abandonment)
          v
     [cancelled] (Terminal, non-reversible)
```

#### Lifecycle Invariants
1. `payment_attempt.status` adheres strictly to the existing PostgreSQL check constraint: `IN ('initiating', 'completed', 'superseded')`. No new enum values are introduced.
2. When Mollie's webhook reports a status of `cancelled`, `failed`, or `expired` via `/api/webhooks/mollie`:
   - Inspect the latest `inventory_reservation` for `platformOrderId`.
   - If `now() <= reservationExpiresAt`, do not transition `platformOrder.status` or `shopOrder.status` to `cancelled`. Leave `platformOrder.status` in `pending_payment` and leave `payment_attempt.status` as `'completed'`.
   - Update `platformOrder.updatedAt = now()` to signal that the reconciliation webhook processed the event, preventing redundant polling cron storms.
3. When a buyer retries payment via `retryPayment(platformOrderId)`:
   - Verify that `order.status === 'pending_payment'`.
   - Verify that an active, unexpired `inventory_reservation` exists for `platformOrderId` (`gt(inventoryReservation.expiresAt, now())`).
   - Transition the previous `payment_attempt` record to `'superseded'`.
   - Insert a new `payment_attempt` record in status `'initiating'` and dispatch `createPayment` to Mollie.
   - Update `platformOrder.molliePaymentId` to the new provider payment ID upon successful creation.
4. Order cancellation occurs strictly via:
   - The background inventory job `cancelAbandonedPendingPaymentOrders`, which selects orders where `status === 'pending_payment'` and all associated `inventory_reservation` records have expired (`expiresAt <= now()`).
   - Explicit admin cancellation or manual review rejection.

### 2. Automatic Refund on Duplicate Payment Captures

On asynchronous European payment rails (e.g. iDEAL, Bancontact, bank transfers), a customer may initiate Attempt 1, experience gateway latency, click retry to create Attempt 2, and have both attempts successfully debited by their bank.

```text
Buyer                  Mollie Gateway            Eurtisan Webhook Handler
  |                          |                              |
  |-- Pay Attempt 1 (iDEAL)->|                              |
  |   (Pending bank auth)    |                              |
  |-- Retry Attempt 2 ------>|                              |
  |   (Card/iDEAL)           |                              |
  |                          |-- Webhook (Attempt 2: Paid)->|
  |                          |                              |-- Mark Order 'paid'
  |                          |-- Webhook (Attempt 1: Paid)->|
  |                          |                              |-- Short Read Tx: Detect Paid!
  |                          |                              |-- Commit Read Tx
  |<-- Auto-Refund Attempt 1-|<-- provider.refundPayment ---|-- Execute Outside Tx
  |                          |                              |-- Emit Duplicate Capture Metric
```

#### Webhook Reconciliation Logic
When a webhook arrives reporting status `paid`:
1. Within a database transaction:
   - Query `platform_order` by ID.
   - If `order.status === 'paid'`:
     - If `molliePaymentId === order.molliePaymentId`, return `{ status: 'already_processed' }`.
     - If `molliePaymentId !== order.molliePaymentId`, this represents an asynchronous duplicate capture. Mark the event in memory and commit the transaction immediately.
   - If `order.status === 'pending_payment'`:
     - Transition `platform_order` and all child `shop_order` records to `paid`, finalize inventory reservations, and commit the transaction.
2. Outside the database transaction:
   - If a duplicate capture was identified, dispatch:
     ```ts
     await provider.refundPayment(molliePaymentId, order.totalCents, {
       idempotencyKey: `dup-refund-${order.id}-${molliePaymentId}`,
     })
     duplicatePaymentCapturesTotal.inc({ provider: 'mollie' })
     logger.error('Duplicate payment capture automatically refunded', {
       alert: true,
       platformOrderId: order.id,
       molliePaymentId,
       primaryPaymentId: order.molliePaymentId,
     })
     return { status: 'refunded_duplicate_capture', platformOrderId: order.id }
     ```

### 3. Database-Level Idempotency and Collision Resolution

To prevent raw PostgreSQL unique constraint violations (code 23505) when users double-click "Place order", persistence handling intercepts duplicate keys at the database query boundary.

```text
Client Request A                     Client Request B (Double-Click)
       |                                            |
       |-- persistCheckoutOrder (tx begins) ------->|-- persistCheckoutOrder
       |-- Insert platformOrder                     |   (Blocks on unique index lock)
       |   (checkoutAttemptId = X)                  |
       |-- Commit transaction                       |
       |                                            |-- Unique index collision!
       |                                            |   Catch 23505 on checkoutAttemptId
       |                                            |-- Query existing order by X
       |-- initiateCheckoutPayment                  |-- Completed attempt exists?
       |   (Calls Mollie, status: initiating)       |   - Yes: decrypt checkoutUrl
       |-- paymentAttempt completed                 |   - No: return platformOrderId with null URL
       |<-- Return checkoutUrl ---------------------|<-- Redirect to /orders/$id/success
```

#### Implementation Mechanism
1. In `createCheckoutWithProvider`, wrap `persistCheckoutOrder` in a try/catch block.
2. If a PostgreSQL error with code `23505` and constraint `platform_order_checkout_attempt_id_unique` is caught:
   - Query `platformOrder` by `input.checkoutAttemptId`.
   - Query the most recent `paymentAttempt` for this `platformOrderId`.
   - If an attempt is `completed` and has an encrypted `checkoutUrl`, decrypt and return the `checkoutUrl`.
   - If no attempt exists yet, or if the attempt is in status `initiating`, return `{ platformOrderId: existingOrder.id, checkoutUrl: null, paymentInitiationFailed: false, reservationExpiresAt: reservation?.expiresAt }`.
   - In `CheckoutPage.tsx`, returning `checkoutUrl: null` automatically redirects the buyer to `/orders/${platformOrderId}/success`, where client-side query polling seamlessly awaits payment initiation settlement without server spinlocks.
   - Increment `checkout_collision_total.inc({ outcome: 'returned_existing' })`.

### 4. Stock Lockout Resolution in Cart Rebuilds

In `src/lib/cart/operations.server.ts:244`, stock availability queries automatically exclude expired reservations (`gte(expiresAt, now())`). Rebuild cart is strictly intended for orders where stock holds have expired or where the order is cancelled.

#### Implementation Mechanism
1. Cart rebuild is available when `remainingSeconds <= 0` or when `order.status === 'cancelled'`. In these states, previous reservations are already ignored by stock checks.
2. If a buyer manually requests a cart rebuild while their order is still in `pending_payment` with an active reservation (voluntary abandonment):
   - In a dedicated transaction, transition `platformOrder.status` and all child `shopOrder.status` rows to `'cancelled'` with `cancellationReason: 'abandoned_for_rebuild'`.
   - Release the active stock reservation using the domain helper `releaseStockInTx(tx, platformOrderId)`.
   - Commit the transaction.
3. Call `addItemToCart` for each item. Stock validation evaluates available quantity without interference from the abandoned order.

### 5. Unified Recovery UI and Route Harmonization

Both `OrderSuccessPage.tsx` and `BuyerOrderDetailPage.tsx` render identical, synchronized recovery actions driven by the order's reservation lifecycle.

#### Shared Recovery Contract
```ts
export interface OrderRecoveryState {
  canRetryPayment: boolean
  canRebuildCart: boolean
  reservationExpiresAt: Date | null
  remainingSeconds: number
  paymentInitiationFailed: boolean
}
```

#### State Rules
*   `canRetryPayment`: `order.status === 'pending_payment' && remainingSeconds > 0`
*   `canRebuildCart`: `remainingSeconds <= 0 || order.status === 'cancelled'`
*   `paymentInitiationFailed`: `order.status === 'pending_payment' && order.paymentInitiationFailed === true`

#### UI Presentation Rules
1. When `paymentInitiationFailed === true`:
   - Do not display the spinning loader "Confirming payment...".
   - Display a warning alert: *"Payment session could not be started. Your items are held for [countdown]. Please try submitting payment again."*
   - Render an immediate "Retry payment" button.
2. When `canRetryPayment === true`:
   - Display a live countdown timer showing remaining reservation time (`MM:SS`).
   - Render a prominent "Retry payment" button with a 15-second cooldown lock to prevent repeated rapid submissions.
3. When `canRebuildCart === true`:
   - Display a notification that the stock hold has expired.
   - Render a "Rebuild cart" button that pre-fills existing delivery information.
4. Route Navigation Harmonization:
   - In `src/routes/orders.$platformOrderId.success.tsx`, remove the 5-minute `pending_payment` redirect block inside the route `loader`. Buyers remain on the success/recovery page until they take action or until the reservation expires.
   - In `src/route-components/orders.$platformOrderId.success.tsx`, update `POLL_TIMEOUT_MS` from `5 * 60 * 1_000` to `15 * 60 * 1_000` to match the reservation duration.
5. Detail View Harmonization:
   - `BuyerOrderDetailPage.tsx` imports `retryPayment` and `rebuildCartFromOrder` directly, managing local loading states and router invalidation, rendering identical recovery controls for `pending_payment` orders.

### 6. Observability and Alerting

#### Telemetry Metrics
Metrics defined in `src/lib/infra/metrics.server.ts`:
```ts
export const checkoutCollisionTotal = new Counter({
  name: 'eurtisan_checkout_collision_total',
  help: 'Total checkout attempt unique constraint collisions',
  labelNames: ['outcome'] as const,
  registers: [metricsRegistry],
})

export const duplicatePaymentCapturesTotal = new Counter({
  name: 'eurtisan_duplicate_payment_captures_total',
  help: 'Total duplicate payment captures automatically refunded',
  labelNames: ['provider'] as const,
  registers: [metricsRegistry],
})

export const paymentInitiationRetriesTotal = new Counter({
  name: 'eurtisan_payment_initiation_retries_total',
  help: 'Total payment retry initiations',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
})

export const strandedPendingOrders = new Gauge({
  name: 'eurtisan_stranded_pending_orders_total',
  help: 'Total pending payment orders without a payment provider ID',
  registers: [metricsRegistry],
})
```

#### Structured Logging
1. In `retryPayment`, log structured error details when `paymentProvider.createPayment` fails, including provider error code, HTTP status, and platform order ID, before throwing HTTP 503.
2. In `reconcileMolliePayment`, emit structured alert logs upon duplicate capture detection and automated refund dispatch.

--------------------------------------------------------------------------------

## Alternatives Considered

### Alternative A: Transitioning `cancelled` back to `pending_payment` (Status Reopening)

*   **Pros:** Requires no changes to `cancelPendingOrder` in `mollie-reconciliation.server.ts`. Re-uses existing cancellation triggers.
*   **Cons:** Violates the foundational domain rule that `cancelled` is an irreversible terminal state (`VALID_TRANSITIONS['cancelled'] = []` in `src/lib/shop-orders/lifecycle.ts`). Leaves child `shop_order` records stranded in `cancelled` status unless manually updated. Corrupts audit fields (`cancelledAt` and `cancellationReason` remain populated on paid orders). Causes webhook reconciliation to trigger unintended refunds against newly retried payments.
*   **Reason for Rejection:** Cyclical state transitions introduce deep architectural debt across accounting, dispute eligibility, and reporting. Decoupling gateway session states (`payment_attempt`) from top-level order states keeps the order in `pending_payment` naturally throughout the active reservation window.

### Alternative B: Two-Phase Cart Retention (Deferring Cart Deletion Until Webhook Settlement)

*   **Pros:** If payment provider initiation fails or is cancelled, the buyer's original cart remains intact without needing a rebuild flow.
*   **Cons:** Causes inventory double-counting against active stock reservations (once in the cart and once in the order's reservation). Creates race conditions if the buyer edits cart items while an order is pending. Causes duplicate carts across tabs.
*   **Reason for Rejection:** The committed `platform_order` and `order_item` records already safely capture buyer intent and hold the stock reservation. Routing the buyer to retry or rebuild from the persisted order solves recovery cleanly without cart synchronization hazards.

### Alternative C: Distributed Message Queuing or Redis Locks for Checkout Submissions

*   **Pros:** Allows queuing concurrent checkout submissions in a buffer before hitting PostgreSQL.
*   **Cons:** Introduces new infrastructure dependencies (Redis, BullMQ, or AWS SQS) to a deployment stack that currently relies strictly on PostgreSQL and Docker Compose. Increases operational complexity and network latency.
*   **Reason for Rejection:** Introduces unneeded operational complexity and an additional network dependency. PostgreSQL's unique constraint `platform_order_checkout_attempt_id_unique` already serializes concurrent inserts at the database transaction boundary. Catching error code `23505` and returning the existing attempt handles rapid double-clicks cleanly with zero new infrastructure.

### Alternative D: Indefinite Payment Retries Without Expiration Gating

*   **Pros:** Simple implementation; buyers can click "Retry payment" at any time regardless of when the order was created.
*   **Cons:** Inventory reservations expire after 15 minutes, returning stock to the marketplace. Allowing retries after expiration risks capturing payment for artisan goods that were already purchased by another customer.
*   **Reason for Rejection:** Retrying must be strictly bounded by active stock reservations. Once the 15-minute reservation expires, buyers must use "Rebuild cart" to verify current inventory before initiating a new payment.

--------------------------------------------------------------------------------

## Risks & Mitigations

### 1. Payment Gateway Latency and Network Partitions
*   **Risk:** External Mollie API calls (`payments.create`, `payments.refund`) may experience network timeouts or 5xx outages.
*   **Mitigation:** External network calls are strictly executed outside database transactions to eliminate connection pool exhaustion. Failed payment creations return `paymentInitiationFailed: true`, preserving the order and reservation for client-driven retries. Duplicate capture refunds supply an idempotency key (`dup-refund-${order.id}-${molliePaymentId}`) to prevent redundant debits during network retries.

### 2. Out-of-Order Webhook Deliveries
*   **Risk:** A cancellation webhook for Attempt 1 might arrive after Attempt 2 was paid, or a delayed paid webhook might arrive after an order was cancelled post-expiry.
*   **Mitigation:** `reconcileMolliePayment` verifies incoming payment IDs against the authoritative order record. Mismatched paid webhooks on paid orders trigger automated refunds rather than mutating order state. Cancellation webhooks check unexpired inventory reservations before modifying order status.

### 3. API Quota Throttling on Retry Storms
*   **Risk:** Rapid repeated clicks on "Retry payment" could exhaust Mollie API rate limits.
*   **Mitigation:** Server-side rate-limiting is enforced by `createUserRateLimitMiddleware(3, 60_000, 'retry_payment')` in `src/lib/checkout.ts:130`. The UI supplements this with an immediate 15-second cooldown lock on retry buttons.

### 4. Concurrent Stock Claim During Abandoned Cart Rebuild
*   **Risk:** If a buyer voluntarily abandons a pending order to rebuild a cart, another buyer could claim the stock during the transition.
*   **Mitigation:** The rebuild operation executes inside a single transaction that transitions the pending order to `cancelled` and releases reservations via `releaseStockInTx` immediately before `addItemToCart` locks product inventory.

--------------------------------------------------------------------------------

## Non-Functional Requirements

### Security & Privacy
*   **Encrypted Data Protection:** Payment URLs and customer contact details remain encrypted at rest via existing `encrypt()` and `decryptJsonb()` utilities.
*   **Webhook Signature Integrity:** All incoming Mollie webhook requests continue to verify payment status authoritatively via Mollie API lookups rather than trusting payload bodies.
*   **PII Minimization:** Audit logs and Prometheus metric labels must never log customer email addresses, physical addresses, or full payment identifiers.

### Performance & Concurrency
*   **Connection Pool Protection:** Database transactions in `persistCheckoutOrder` and `reconcileMolliePayment` must acquire connection handles strictly after external network calls have settled.
*   **API Debounce & Throttling:** Client components enforce a 15-second cooldown lock on "Retry payment" actions, supplemented by server-side rate-limiting.

### Rollout & Rollback Safety
*   **Zero-Downtime Deployment:** The changes require no DDL schema migrations; all tables (`platform_order`, `payment_attempt`, `inventory_reservation`) already support the necessary columns and check constraints.
*   **Safe Reversibility:** If code must be rolled back, legacy orders remain intact. Reconciliation changes are purely additive.

--------------------------------------------------------------------------------

## Detailed Implementation Plan

### Target Files to Create/Modify

#### 1. `src/lib/checkout/operations.server.ts` (Modify)
*   **Type / Scope:** Server-side checkout operation handler
*   **Proposed Changes:**
    1. In `createCheckoutWithProvider`, wrap `persistCheckoutOrder` in a catch block for PostgreSQL error code `23505` (`platform_order_checkout_attempt_id_unique`).
    2. On collision, query `platformOrder` by `input.checkoutAttemptId` and inspect its associated `paymentAttempt` records.
    3. If an attempt is `completed` with a decrypted `checkoutUrl`, return the `checkoutUrl`.
    4. If the attempt is `initiating` or missing, return `{ platformOrderId: existingOrder.id, checkoutUrl: null, paymentInitiationFailed: false, reservationExpiresAt: reservation?.expiresAt }`.
    5. Increment `checkout_collision_total.inc({ outcome: 'returned_existing' })`.
*   **Rationale:** Eliminates raw PostgreSQL 500 errors on rapid double-submits and allows client-side polling on the success route to await payment initiation settlement without server spinlocks.

#### 2. `src/lib/checkout/payment.server.ts` (Modify)
*   **Type / Scope:** Checkout payment orchestration and retries
*   **Proposed Changes:**
    1. In `initiateCheckoutPayment`, log structured provider errors (`logger.error('Payment initiation failed in createCheckout', error, { alert: true, platformOrderId })`) before returning `null`.
    2. In `retryPayment`, log structured error details when `createPayment` fails before throwing HTTP 503.
    3. Ensure `retryPayment` verifies that `gt(inventoryReservation.expiresAt, new Date())` and allows retrying for orders in `pending_payment`.
    4. In `createAndPersistPayment`, check if an existing `paymentAttempt` is still in status `completed` with status `open`/`pending` on Mollie; if so, decrypt and return its `checkoutUrl` directly instead of cancelling it.
*   **Rationale:** Fixes swallowed error logs during 503 responses, prevents unnecessary cancellation of active Mollie links, and enforces reservation-bounded retries.

#### 3. `src/lib/payments/mollie-reconciliation.server.ts` (Modify)
*   **Type / Scope:** Webhook reconciliation and background settlement worker
*   **Proposed Changes:**
    1. In `cancelPendingOrder`, query `inventoryReservation.expiresAt` for `platformOrderId`. When `now() <= reservationExpiresAt`, do not transition `platformOrder.status` or `shopOrder.status` to `cancelled`; update `platformOrder.updatedAt = now()` and return `'already_processed'`.
    2. In `reconcileMolliePayment`, when a webhook reports status `paid` for an order that is already in `status === 'paid'` with a different payment ID, invoke `provider.refundPayment(molliePaymentId, order.totalCents, { idempotencyKey: `dup-refund-${order.id}-${molliePaymentId}` })` outside the database transaction.
    3. Increment `duplicatePaymentCapturesTotal.inc({ provider: 'mollie' })` and emit an alert log.
    4. Update `reconcilePendingMolliePayments` cron query to exclude orders whose latest `paymentAttempt` is in status `initiating`.
*   **Rationale:** Decouples gateway churn from top-level order status, eliminates unintended refunds on retried payments, and prevents silent loss of customer funds on duplicate captures without holding row locks.

#### 4. `src/lib/checkout/rebuild-cart.server.ts` (Modify)
*   **Type / Scope:** Cart rebuild server function
*   **Proposed Changes:**
    1. When rebuilding a cart from an order in `pending_payment` with active reservations (voluntary abandonment), transition the order to `cancelled` with `cancellationReason: 'abandoned_for_rebuild'` and release stock using `releaseStockInTx(tx, platformOrderId)` in a dedicated transaction prior to calling `addItemToCart`.
    2. If the reservation has already expired or the order is already cancelled, invoke `addItemToCart` directly since expired reservations are automatically excluded by availability checks.
*   **Rationale:** Eliminates nested transaction conflicts and prevents inventory deadlocks during cart rebuilds.

#### 5. `src/lib/orders/types.ts` & `src/lib/orders/operations.server.ts` (Modify)
*   **Type / Scope:** Order detail public contracts and loader queries
*   **Proposed Changes:**
    1. Add `reservationExpiresAt: Date | null` and `paymentInitiationFailed: boolean` to the `OrderDetail` interface.
    2. In `getBuyerOrderDetailQuery`, join `inventoryReservation` to select the latest `expiresAt`. Set `paymentInitiationFailed = (order.status === 'pending_payment' && order.molliePaymentId === null)`.
*   **Rationale:** Supplies client components with clean domain properties to drive countdown timers and initiation failure alerts without leaking internal gateway identifiers.

#### 6. `src/routes/orders.$platformOrderId.success.tsx` & `src/route-components/orders.$platformOrderId.success.tsx` (Modify)
*   **Type / Scope:** TanStack Router route declaration and component
*   **Proposed Changes:**
    1. In `src/routes/orders.$platformOrderId.success.tsx`, remove the 5-minute `pending_payment` redirect block inside the route `loader`.
    2. In `src/route-components/orders.$platformOrderId.success.tsx`, update `POLL_TIMEOUT_MS` from `5 * 60 * 1_000` to `15 * 60 * 1_000`.
*   **Rationale:** Keeps buyers on the recovery surface throughout the full 15-minute reservation window with active real-time settlement polling.

#### 7. `src/components/OrderSuccessPage.tsx` (Modify)
*   **Type / Scope:** Order confirmation UI component
*   **Proposed Changes:**
    1. Pass `order.reservationExpiresAt` to a countdown timer hook (`remainingSeconds`).
    2. If `order.status === 'pending_payment'` and `order.paymentInitiationFailed === true`, render a warning alert: *"Payment could not be started. Your items are held for [countdown]. Please try submitting payment again."* with an immediate retry button.
    3. Render a live countdown timer (`MM:SS`) while the reservation is active.
    4. Implement a 15-second cooldown lock on the "Retry payment" button after click.
*   **Rationale:** Eliminates unbounded loading indicators on gateway failures, makes remaining hold time visible, and prevents gateway rate-limiting.

#### 8. `src/components/BuyerOrderDetailPage.tsx` (Modify)
*   **Type / Scope:** Buyer order detail UI component
*   **Proposed Changes:**
    1. Directly import `retryPayment` and `rebuildCartFromOrder` from `#/lib/checkout`.
    2. When `order.status === 'pending_payment'`, render recovery controls identical to `OrderSuccessPage`: live reservation countdown timer, "Retry payment" button (with 15-second cooldown lock), and "Rebuild cart" button once expired.
*   **Rationale:** Ensures buyers have an uninterrupted self-service path to complete payment regardless of which route they land on.

#### 9. `src/lib/infra/metrics.server.ts` (Modify)
*   **Type / Scope:** Prometheus telemetry registry
*   **Proposed Changes:**
    1. Define and export:
       - `checkoutCollisionTotal = new Counter({ name: 'eurtisan_checkout_collision_total', help: 'Total checkout attempt unique constraint collisions', labelNames: ['outcome'], registers: [metricsRegistry] })`
       - `duplicatePaymentCapturesTotal = new Counter({ name: 'eurtisan_duplicate_payment_captures_total', help: 'Total duplicate payment captures automatically refunded', labelNames: ['provider'], registers: [metricsRegistry] })`
       - `paymentInitiationRetriesTotal = new Counter({ name: 'eurtisan_payment_initiation_retries_total', help: 'Total payment retry initiations', labelNames: ['status'], registers: [metricsRegistry] })`
       - `strandedPendingOrders = new Gauge({ name: 'eurtisan_stranded_pending_orders_total', help: 'Total pending payment orders without a payment provider ID', registers: [metricsRegistry] })`
*   **Rationale:** Provides production visibility, alerting, and SLA tracking across checkout and payment reconciliation paths.

#### 10. `src/lib/jobs/inventory.server.ts` (Modify)
*   **Type / Scope:** Background inventory job
*   **Proposed Changes:**
    1. In `cancelAbandonedPendingPaymentOrders`, update query to verify that associated `inventory_reservation` records have expired, aligning order cancellation with the 15-minute reservation window.
    2. Update gauge `strandedPendingOrders.set(...)` with the count of orders in `pending_payment` with `molliePaymentId IS NULL`.
*   **Rationale:** Aligns background cancellation with domain reservation expiry and updates telemetry.

#### 11. `src/lib/checkout.test.ts` (Modify)
*   **Type / Scope:** Integration test suite
*   **Proposed Changes:**
    1. Add test: `createCheckoutWithProvider` catches PostgreSQL 23505 on concurrent duplicate `checkoutAttemptId` and returns the existing order.
    2. Update test: `rebuildCartFromOrderQuery` handles single-unit items by verifying expired reservations do not block stock.
    3. Update test: `retryPayment` succeeds on an order in `pending_payment` with an active reservation.
    4. Update test: `createCheckoutWithProvider` flags `paymentInitiationFailed: true` when provider returns null.
*   **Rationale:** Verifies checkout idempotency and cart rebuild invariants against a real database.

#### 12. `src/lib/payments/mollie-reconciliation.server.test.ts` (Modify)
*   **Type / Scope:** Webhook reconciliation test suite
*   **Proposed Changes:**
    1. Add test: When webhook reports `cancelled` while reservation is active, `platformOrder.status` remains `pending_payment`.
    2. Add test: Asynchronous duplicate capture on already-paid order invokes `provider.refundPayment` outside transactions and increments `duplicatePaymentCapturesTotal`.
*   **Rationale:** Validates reconciliation lifecycle rules and automated refund protection.

#### 13. `src/components/OrderSuccessPage.test.tsx` & `src/routes/orders.test.tsx` (Modify)
*   **Type / Scope:** Component test suites
*   **Proposed Changes:**
    1. Add test: Renders initiation failure warning and immediate retry button when `paymentInitiationFailed` is true.
    2. Add test: Renders live reservation countdown timer when `reservationExpiresAt` is present.
    3. Add test: Enforces 15-second cooldown lock on retry button.
    4. Add test: `BuyerOrderDetailPage` renders recovery controls for `pending_payment` orders.
*   **Rationale:** Ensures UI stability and prevents visual regressions on payment failure surfaces.

--------------------------------------------------------------------------------

### Single Implementation Sequence

1. **Step 1: Metrics & Telemetry Setup**
   - Define Prometheus counters and gauge in `src/lib/infra/metrics.server.ts` with `help` and `registers`.
2. **Step 2: Webhook Reconciliation Decoupling & Duplicate Capture Refunds**
   - Update `cancelPendingOrder` in `src/lib/payments/mollie-reconciliation.server.ts` to keep `platform_order` in `pending_payment` while reservation is active.
   - Add duplicate capture detection and automated refund logic executed outside the transaction in `reconcileMolliePayment`.
3. **Step 3: Background Worker Alignment**
   - Update `cancelAbandonedPendingPaymentOrders` in `src/lib/jobs/inventory.server.ts` to evaluate expired reservations and update `strandedPendingOrders` gauge.
4. **Step 4: Persistence Idempotency on Attempt Collisions**
   - In `src/lib/checkout/operations.server.ts`, wrap `persistCheckoutOrder` to catch PostgreSQL `23505` on `checkoutAttemptId` and return the existing attempt.
5. **Step 5: Payment Retry & Logging Hardening**
   - In `src/lib/checkout/payment.server.ts`, add structured logging in `retryPayment` and `initiateCheckoutPayment`.
   - Decrypt and reuse existing `completed` payment attempt URLs if still open on Mollie.
6. **Step 6: Public Order Contract & Loader Expansion**
   - Add `reservationExpiresAt` and `paymentInitiationFailed` to `OrderDetail` in `src/lib/orders/types.ts` and populate them in `getBuyerOrderDetailQuery`.
7. **Step 7: Route Navigation Alignment**
   - In `src/routes/orders.$platformOrderId.success.tsx`, remove the 5-minute redirect.
   - In `src/route-components/orders.$platformOrderId.success.tsx`, update `POLL_TIMEOUT_MS` to 15 minutes.
8. **Step 8: UI Unification on Confirmation & Detail Views**
   - Update `src/components/OrderSuccessPage.tsx` with live countdown, 15-second cooldown lock, and initiation failure alert.
   - Update `src/components/BuyerOrderDetailPage.tsx` with direct server-function recovery controls.
9. **Step 9: Test Suite Expansion & Verification**
   - Update and execute `src/lib/checkout.test.ts`, `src/lib/payments/mollie-reconciliation.server.test.ts`, and component test suites.

--------------------------------------------------------------------------------

### Verification Plan

*   **Static Analysis & Type Checking:**
    - Command: `make check`
    - Invariant: Zero TypeScript diagnostics across all touched files.
*   **Code Formatting & Linting:**
    - Command: `make lint` and `make format`
    - Invariant: Zero ESLint or Prettier violations.
*   **Targeted Unit & Integration Tests:**
    - Command: `make test src/lib/checkout.test.ts src/lib/payments/mollie-reconciliation.server.test.ts src/components/OrderSuccessPage.test.tsx`
    - Invariant: All tests pass deterministically against containerized PostgreSQL test databases.
*   **Full Test Suite Run:**
    - Command: `make test`
    - Invariant: Entire test suite passes without regressions across existing orders, disputes, and payouts subsystems.

--------------------------------------------------------------------------------

*Drafted with EGM*
