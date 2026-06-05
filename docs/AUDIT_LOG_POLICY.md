# Audit log policy

## What is logged

| Class | Examples | Logged? |
|-------|----------|---------|
| **Mutations** | Role changes, bans, category CRUD, payout sent, dispute resolve, shop moderation | Yes — `emitAuditEvent` |
| **Reads (lists/detail)** | Admin orders list, dashboard stats, user search | No — volume and low compliance value |

## Rationale

- Write actions are irreversible or legally sensitive; they must be attributable to an admin actor.
- Read endpoints are used continuously by staff; logging every list view would inflate storage without matching GDPR "access log" requirements (those are covered by application auth sessions and infrastructure logs).

## Retention

- Application `audit_log` rows: purged by `job:audit-log-cleanup` (see job schedule / env).
- Infrastructure logs (Loki): see `infra/observability/loki/loki.yml` and production retention overrides.

## Future

If regulators or insurers require read trails for specific resources, add targeted `emitAuditEvent` on export/download endpoints only—not blanket list logging.
