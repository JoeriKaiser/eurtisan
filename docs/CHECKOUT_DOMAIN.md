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

## Preserved contracts

- `getCheckoutSummary`, `createCheckout`, `getServicePoints`, and
  `retryPayment` keep their existing server-function input and response shapes.
- `getCheckoutSummaryQuery`, `createCheckoutQuery`, `createCheckoutWithProvider`,
  and `retryPayment` remain available from `src/lib/checkout.server.ts`.
- No route, URL, database schema, payment-provider contract, or checkout UI
  contract changes as part of this decomposition.

## Checkout invariants

- Carrier rates are refreshed and selections are validated against the current
  provider result; client-supplied shipping costs are never persisted.
- Cart ownership is checked before checkout work begins. Order creation then
  revalidates product/shop availability and stock inside the transaction.
- Product rows are locked in sorted order, cart reservations are released and
  observed within the same transaction, and order reservations are recreated
  atomically.
- Payment is initiated outside the transaction. A provider failure leaves the
  order pending payment with its stock reservation intact for retry.
- Notifications are scheduled only after payment initiation succeeds and do
  not block the checkout response.
