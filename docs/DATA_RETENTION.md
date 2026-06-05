# Data retention policy

Summary for GDPR and operations. Align `/privacy` if customer-facing text must match.

| Data type | Retention | Notes |
|-----------|-----------|--------|
| Orders & invoices | 10 years (FR tax) | PII retained after account deletion where legally required |
| Audit log | ~2 years | `AUDIT_LOG_POLICY.md`, `job:audit-log-cleanup` |
| Application logs (Loki) | 30 days | `retention_period: 720h` in `infra/observability/loki/loki.yml` |
| Sessions | Until expiry | `job:session-cleanup` |
| Email suppression | Until removed | Brevo hard bounces / complaints |
| S3 uploads | Until entity deleted | Optional bucket lifecycle rules |
| DB backups | 30 days (+ off-site) | `infrastructure/README.md` |

Review when adding PII or changing observability retention.
