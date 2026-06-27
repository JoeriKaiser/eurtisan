# Database Transaction Guidelines

## Rule

**No external I/O inside DB transactions unless idempotent and unavoidable.**

Network calls, notification creation, and third-party API validation must happen **before** a transaction opens or **after** it commits. Holding a transaction open during I/O extends lock hold time, increases contention, and can stall concurrent checkout or order operations.

## Why

PostgreSQL row locks acquired inside a transaction are held until the transaction commits or rolls back. If the application performs a slow network call while holding those locks, other requests that need the same rows are blocked, which can cascade into latency spikes or timeouts.

## Examples

| Operation | Location | Rationale |
|-----------|----------|-----------|
| Create shipping label via Sendcloud | Before the DB transaction that marks an order as shipped | Label creation is a slow external API call and is not required for the DB consistency of the status update. |
| DAC7 compliance warning notification | After the DB transaction that marks an order as delivered | The notification is best-effort; delivery must not depend on notification success. |
| Service point validation | Before the checkout DB transaction | The point is re-verified by the provider at label creation time, so pre-transaction validation is sufficient. |
| Payment refund via Mollie | Inside the transaction is acceptable because the refund is the atomic financial action that must succeed or fail with the order state change. Keep the surrounding work minimal. |

## Exceptions

An external call may remain inside a transaction only when:

1. The call is idempotent and unavoidable for correctness (e.g., a payment capture that must be recorded exactly once).
2. Moving it outside would create a double-spend, double-refund, or inventory inconsistency.
3. The trade-off is documented and reviewed.

## Handling failures

- If an external call after commit fails, log an actionable error with `logger.error(..., { alert: true, ... })` and continue. Do not fail the request if the core DB work is already consistent.
- If losing the side effect is unacceptable, route it through a background job or outbox pattern instead of holding the transaction.
