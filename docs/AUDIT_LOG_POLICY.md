# Audit log policy

## What is logged

| Class | Examples | Logged? |
|-------|----------|---------|
| **Mutations** | Role changes, bans, category CRUD, payout sent, dispute resolve, shop moderation, review moderation | Yes — `emitAuditEvent` |
| **Admin reads (lists/detail)** | Admin orders list, dashboard stats, user search, payout history, audit log views | Yes — `emitAdminReadAudit` |
| **Public/owner reads** | Buyer order history, owner product list, public shop pages | No — covered by application auth sessions and infrastructure logs |

## Rationale

- Write actions are irreversible or legally sensitive; they must be attributable to an admin actor.
- Admin read access to owner/customer data is audited for accountability and incident response; events use the `admin.read.{resource}` action namespace and include only query parameters and result counts, never full payloads or PII.
- Public and owner-facing read endpoints are used continuously by end users; logging every list view would inflate storage without matching GDPR "access log" requirements (those are covered by application auth sessions and infrastructure logs).

## Retention

- Application `audit_log` rows: purged by `job:audit-log-cleanup` (see job schedule / env).
- Infrastructure logs (Loki): see `infra/observability/loki/loki.yml` and production retention overrides.

## Future

If regulators or insurers require read trails for specific resources, add targeted `emitAuditEvent` on export/download endpoints only—not blanket list logging.
