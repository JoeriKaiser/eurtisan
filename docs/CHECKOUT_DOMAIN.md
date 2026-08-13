# Checkout domain responsibilities

The checkout workflow creates a platform order only after it has validated a
fresh carrier quote, persisted a consistent order tree, reserved inventory,
and started payment. Its responsibilities are intentionally separated by
transaction and external-provider boundaries rather than file size.

| Module | Responsibility | Boundary rationale |
| --- | --- | --- |
| `src/lib/checkout.ts` | Browser-importable server-function contracts and input validation | Maintains the public RPC surface without importing database or provider implementations. |
| `src/lib/checkout.server.ts` | Checkout finalization orchestration and stable server exports | Coordinates the ordered workflow while retaining existing query and response contracts. |
| `src/lib/checkout/types.ts` | Shared checkout data contracts | Keeps serializable data shapes independent from persistence and provider implementations. |
| `src/lib/checkout/summary.server.ts` | Buyer-owned cart projection, legal disclosures, and display estimates | Summary data is read-only and must never be trusted as an order-creation authority. |
| `src/lib/checkout/shipping.server.ts` | Carrier quote and service-point lookup, fallback policy, rate/service-point validation | Provider availability and client-provided shipping totals are external-input concerns that must be resolved before database mutation. |
| `src/lib/checkout/tax.server.ts` | Reverse-charge eligibility and inclusive VAT calculations | VAT decisions are shared by display estimates and persisted order values, so they have one tested implementation. |
| `src/lib/checkout/order-persistence.server.ts` | Atomic order tree creation, total reconciliation, and inventory reservation | All state changes, row locks, and reservation transfer execute inside one database transaction. |
| `src/lib/checkout/payment.server.ts` | Payment initiation, payment-ID persistence, and retry authorization checks | Mollie calls occur only after order persistence commits, preventing network latency from holding database locks. |
| `src/lib/checkout/notifications.server.ts` | Post-checkout notification and email scheduling | Notification provider work is asynchronous and cannot change a completed checkout result. |
| `src/lib/checkout/guest-access.server.ts` | Hashed guest-order tokens, encrypted recipient delivery, access-cookie exchange, and verified-account claiming | Guest links are short-lived, scoped to one order, hashed at rest, and never exposed through order payloads or logs. |
| `src/lib/returns/` | Return eligibility, policy snapshots, request state, shipping evidence, seller actions, and refund orchestration | Return decisions use the purchase-time policy snapshot and preserve per-shop financial boundaries. |

## Public contracts

- `getCheckoutSummary`, `createCheckout`, `getServicePoints`, `retryPayment`, and
  `rebuildCartFromOrder` are browser-safe server-function contracts.
- Checkout submissions carry a durable `checkoutAttemptId`; duplicate submissions
  recover the already-persisted order rather than creating another order tree.
- Payment initiation can return `checkoutUrl: null` after a provider failure. The
  buyer is sent to the order status page, where retry targets the same order while
  its reservation remains active.
- Guest order access is exchanged at `/guest-order-access`; the emailed raw token
  is hashed at rest and becomes an HttpOnly, same-site, single-order cookie.

## Checkout invariants

- Carrier rates are refreshed and selections are validated against the current
  provider result; client-supplied shipping costs are never persisted.
- Cart ownership is checked before checkout work begins. Order creation then
  revalidates product/shop availability and stock inside the transaction.
- Product rows are locked in sorted order, cart reservations are released and
  observed within the same transaction, and order reservations are recreated
  atomically.
- Payment is initiated outside the transaction with a provider idempotency key.
  A provider failure leaves the order pending payment with its 15-minute stock
  reservation intact for retry. Cancelled/failed provider states retain the same
  retryable order until that reservation expires.
- Once a reservation expires, payment retry is denied and the buyer can rebuild a
  cart from items that are still available.
- Shipping submission is blocked until a fresh, non-fallback quote exists. Stale
  asynchronous responses cannot overwrite a newer address request.
- Guest checkout uses an anonymous Better Auth identity only as an internal owner;
  it is not presented as an account. Verified accounts claim matching guest orders
  by normalized email hash.
- Product return-policy and standard-shipping snapshots are persisted with the
  order so later policy changes cannot rewrite the buyer's purchase-time rights.
- The configurable baseline provides 14-day withdrawal and return-shipment windows
  plus a 730-day defective-goods reporting window. Refunds start after recorded
  receipt; a seller may explicitly mark an awaiting shipment received when it has
  accepted sufficient shipping evidence.
- Notifications and guest-access email scheduling do not block the checkout result.
