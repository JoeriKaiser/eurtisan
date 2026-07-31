# Data retention policy

Summary for GDPR and operations. Align `/privacy` if customer-facing text must match.

| Data type | Retention | Notes |
|-----------|-----------|--------|
| Orders, return records & invoices | 10 years (FR tax/transaction evidence) | Financial records and policy snapshots retained; direct PII is encrypted and redacted on account deletion where permitted |
| Guest-order access tokens | 24 hours or until order claim | Only token/email hashes are stored in the access table; raw tokens exist only in email and the HttpOnly order-access cookie |
| Audit log | ~2 years | `AUDIT_LOG_POLICY.md`, `job:audit-log-cleanup` |
| Application and consented Faro logs/errors (Loki) | 30 days | `retention_period: 720h` in `infra/observability/loki/loki.yml` |
| Browser and server traces (Tempo) | 7 days | `block_retention: 168h` in `infra/observability/tempo/tempo.yml` |
| Operational metrics (Prometheus) | 15 days | `--storage.tsdb.retention.time=15d` in the observability Compose model |
| Optional Umami analytics | Disabled | Production deployment defaults keep Umami off; confirm and document retention before enabling |
| Browser analytics preference | Until changed or browser storage is cleared | Stored in localStorage; Faro's non-persistent session identifier is tab-bound |
| Sessions | Until expiry | `job:session-cleanup` |
| Email suppression | Until removed / 30 days for soft bounces | `job:email-suppression-cleanup`; hard bounces/spam are permanent |
| Email outbox | 7 days for terminal rows | `job:email-retention-cleanup` deletes sent/failed/suppressed/bounced rows |
| Email send log | 90 days (configurable) | `job:email-retention-cleanup`; set `EMAIL_SEND_LOG_RETENTION_DAYS` |
| Brevo webhook events | 30 days | `job:email-retention-cleanup` |
| Sendcloud webhook events | 30 days | `job:sendcloud-retention-cleanup` |
| Payout reconciliation logs | 365 days (configurable) | `job:payout-reconciliation-log-cleanup`; set `PAYOUT_RECONCILIATION_LOG_RETENTION_DAYS` |
| In-app notifications | 365 days after being **read** (configurable) | `job:notification-cleanup`; set `NOTIFICATION_RETENTION_DAYS`. Unread notifications are never purged — they are undelivered information, and age is not consent to forget. The clock runs from `read_at`, not creation |
| S3 uploads | Until entity deleted | Optional bucket lifecycle rules |
| DB backups | 30 days local, 90 days off-site | `infrastructure/README.md`; configure `BACKUP_RETENTION_DAYS` and `BACKUP_OFFSITE_RETENTION_DAYS` |

Review when adding PII or changing observability retention.

## Account deletion / right-to-erasure

Self-service deletion is implemented in `src/lib/account-data.server.ts` (`deleteUserAccount`). The user row is anonymized (`name` → `'Deleted User'`, `email` → `deleted-<uuid>@anonymized.eurtisan.invalid`, `deletedAt` set) and the following retained data is redacted:

| Table | Columns retained | Redaction on deletion |
|-------|------------------|-----------------------|
| `user` | `id`, `role`, `createdAt`, `updatedAt`, `deletedAt` | `name`, `email`, `image` anonymized; `emailVerified`, `twoFactorEnabled` reset |
| `platform_order` | All order financial/transaction data | `shippingAddress`, `billingAddress` replaced with redacted address object; encrypted `buyerEmail` and its lookup hash cleared; guest flag reset |
| `shop_order` | All order financial/fulfillment data | No direct PII; retained for tax/dispute history |
| `invoices` | `invoiceNumber`, type, amounts, VAT, shop order link | `billingDetails` replaced with redacted address object for both seller invoices (shops owned by the user) and buyer invoices (orders placed by the user) |
| `shop` (owned) | `id`, name, slug, status, financial/tax data | `businessAddress`, `shippingOrigin` replaced with redacted address object; status set to `archived` |
| `payout_reconciliation_log` | Event metadata required for reconciliation | `payload` personal fields (`buyerName`, `buyerEmail`, `address`, `shippingAddress`, `billingAddress`, `name`, `email`) masked or replaced |
| `audit_log` | `actorId`, action, resource, metadata | `actorName` set to `'Deleted User'`; `actorId` kept for traceability |
| `order_item` | Product snapshots, quantities, prices | No direct PII; retained for order history |
| `review` | Rating, product link | `comment` set to `null` |
| `dispute` | Reason, status, resolution | `description` redacted |
| `dispute_message` (sent by user) | Thread context | `message` replaced with `'[message removed — account deleted]'` |
| `return_request` | Status, item/refund totals, deadlines, policy version, shipping evidence | Free-text `reason` redacted; financial and lifecycle evidence retained |
| `return_request_message` (sent by user) | Thread context | `message` replaced with `'[message removed — account deleted]'` |
| `guest_order_access` | None | Rows for the user's orders are deleted and links stop authorizing access |
| `owner_message_thread` | Thread metadata | `subject` set to `'[REDACTED]'` |
| `owner_message` | Message thread context | `body` set to `'[REDACTED]'` |
| `customer_note` | Shop owner notes | `content` set to `'[REDACTED]'` |
| `customer_tag` | Shop owner tags | Rows for the deleted user removed |
| `shipping_label` | Carrier/tracking record for the buyer's orders | `label_url` cleared; `carrier`, `tracking_number`, `external_parcel_id`, and `created_at` retained |

Deleted rows in `session`, `account`, `twoFactor`, `notification`, `cart`, and `cart_item` are removed. `product` rows belonging to owned shops are deactivated (`isActive = false`).

The deletion workflow blocks `admin` users and rejects deleted users at authentication time (`authMiddleware`, `src/lib/server-auth.ts`, `src/lib/authz.ts`).
