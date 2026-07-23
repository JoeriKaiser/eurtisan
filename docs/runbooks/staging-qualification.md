# Staging launch qualification

Staging qualification is a release evidence process, not a deployment command and not legal approval. Repository-local checks prove packaging and configuration structure; only an authorized EU-region staging environment with isolated data and sandbox provider accounts can prove external behavior.

Do not run remote commands, inspect Vault, or use provider credentials without explicit owner authorization. Never paste response bodies, request headers, cookies, addresses, email addresses, tokens, or provider credentials into evidence.

## Promotion identity

A qualification is tied to all four values below:

- full 40-character Git commit;
- immutable image repository and `sha256` digest;
- SHA-256 digest of the compiled `client-config.json`;
- EU staging region.

The host must run the recorded image digest; a mutable tag is not qualification evidence. Ansible publishes the environment-qualified staging variant to the private `fr-par` registry, signs its digest, verifies it, and reports it for this record. Because browser-visible configuration remains immutable build input, production is a separately built and signed variant of the approved Git SHA rather than the same bytes. Production preflight requires this qualified staging digest as the explicit promotion input. See [Signed release promotion and rollback](./release-promotion-and-rollback.md).

## Evidence lifecycle

Create an honest draft only after an immutable image exists:

```bash
make staging-evidence-create \
  QUALIFICATION_ID=staging-YYYY-MM-DD-release-name \
  QUALIFICATION_REGION=fr-par \
  QUALIFICATION_GIT_SHA=<40-character-sha> \
  QUALIFICATION_IMAGE_REPOSITORY=<repository> \
  QUALIFICATION_IMAGE_DIGEST=sha256:<64-hex> \
  QUALIFICATION_PUBLIC_CONFIG_DIGEST=sha256:<64-hex> \
  QUALIFICATION_EVIDENCE=evidence/staging-qualification.json
```

The command creates a mode-0600 file with every check set to `not-run`; it refuses to overwrite an existing file. Evidence files are operational records and should normally live in an access-controlled evidence store, not Git. If a redacted evidence file is reviewed for retention, validate it first:

```bash
make staging-evidence-validate QUALIFICATION_EVIDENCE=evidence/staging-qualification.json
make staging-evidence-final QUALIFICATION_EVIDENCE=evidence/staging-qualification.json
```

Final validation requires every check, including owner approvals, to be `passed`, with an executor and ISO timestamp. The schema rejects missing/duplicate checks, unsafe paths, credential-like text, cookies, JWTs, provider-key patterns, and email addresses. Store links to restricted dashboards or redacted reports; do not inline their contents.

## Repository-local and CI qualification

These checks do not access staging:

```bash
make format
make lint
make check
make db-check
make db-migrate-fresh
make test
make build
make bundle-check
make production-image-smoke
make compose-check
make promtool-check
make ci-workflow-check
make shell-syntax
make ansible-check
make e2e
```

Record CI run links and the immutable image digest under `release.ci-gates`. Local E2E uses mocks and isolated local data; it is not evidence that a provider sandbox or staging proxy works.

## Authorized public smoke

After owner authorization, run the non-authenticated smoke against the recorded release:

```bash
make staging-smoke \
  STAGING_BASE_URL=https://staging.eurtisan.eu \
  EXPECTED_RELEASE=<40-character-sha> \
  > evidence/staging-public-smoke.json
```

It validates HTTPS reachability (therefore DNS, certificate trust, and the TLS handshake), security headers, all health/readiness endpoints, and the compiled release. It does not print response bodies or cookie values. Review certificate issuer, SANs, expiry, HTTP-to-HTTPS redirect, HSTS preload policy, and DNS records separately because those require real external observations.

## Environment checklist

### Release and infrastructure

- **`release.immutable-image`** — capture `docker image inspect`/registry evidence showing the running service and promotion candidate use the recorded digest; verify no host rebuild occurred.
- **`release.public-config`** — match `VITE_APP_VERSION` and the public config digest; verify public Meilisearch credentials are search-only without recording the value.
- **`infrastructure.eu-region`** — owner confirms compute, PostgreSQL, object storage, backups, logs, and traces reside in approved EU regions.
- **`infrastructure.dns-tls`** — validate A/AAAA/CNAME records, trusted certificate chain, SAN, expiry/renewal, HTTP redirect, TLS policy, and HSTS.

### Security boundary

- **`security.headers-csp`** — check CSP on nonce-bearing HTML and edge error/static responses; verify frame, MIME, referrer, permissions, COOP/CORP policies and browser console violations.
- **`security.cookies`** — inspect attributes only: `Secure`, `HttpOnly` where applicable, intended `SameSite`, path/domain scope, expiry, session rotation, logout invalidation. Never save cookie values.
- **`security.csrf`** — from an isolated account, prove protected state changes reject missing/invalid origin or token and accept a valid same-origin request.
- **`security.rate-limits`** — use dedicated accounts/IPs in an approved window; verify auth and mutation thresholds, `429`, recovery window, and observability without locking real users.
- **`security.proxy-headers`** — verify the application trusts only the deployment proxy and derives HTTPS origin/client IP correctly; attempt spoofed forwarded headers through a controlled direct path.
- Verify privileged creator/admin E2E with 2FA enabled and no test bypass.

### Health, migrations, jobs, and recovery

- **`health.liveness-readiness`** — healthy status, dependency degradation, startup behavior, and no restart loop. Readiness must not depend on non-critical provider latency.
- **`database.migrations`** — run the full chain on an isolated empty database and the deployment migration against staging; record duration and schema/journal verification.
- **`jobs.required-services`** — confirm every required job container uses the same image digest, is single-instance/locked, reports recent success, and restarts with backoff.
- **`jobs.reconciliation`** — exercise payment, payout, Sendcloud, inventory, financial-total, cleanup, and retention reconciliation with controlled records; verify idempotency.
- **`jobs.financial-discrepancy-detection`** — status `not-run` until an operations owner, with accounting review, uses an isolated non-PII staging qualification database to seed a deterministic one-cent discrepancy. Run a temporary continuous production-image service against the clone and verify its correlated mismatch log/metric/alert; separately run `bun run job:financial-totals-reconciliation --once` and expect exit 2, then destroy or restore the clone and expect exit 0. Also verify failed/stale alert routing. See [financial-reconciliation.md](./financial-reconciliation.md).
- **`database.backup-restore`** — create a real staging backup, restore into a new isolated database, verify critical row counts and encrypted-column decryption with the authorized key, measure RPO/RTO, then destroy the clone.
- **`resilience.rollback`** — rehearse application rollback using a backward-compatible schema and the recorded rollback criteria. Do not claim database rollback from an image rollback.

### Provider sandboxes

Each item requires provider-dashboard evidence and correlated safe application observability. Do not use live-money or production credentials.

- **Mollie Payments:** authorize/cancel/fail/expire, captured payment, refund, delayed webhook, duplicate webhook, reconciliation, and sandbox chargeback where supported.
- **Mollie Connect:** creator onboarding with 2FA, token refresh/disconnect, route creation, payout status/reversal/return, reconciliation.
- **Sendcloud:** rates/service point, label, tracking transitions, signed webhook rejection/acceptance, duplicate delivery, reconciliation.
- **Email:** authorized staging provider or Mailpit policy, SPF/DKIM/DMARC for the eventual production sender, templates, bounce/complaint webhook, suppression and retention. Mailpit alone is not Brevo deliverability evidence.
- **VIES:** valid/invalid/unavailable behavior using non-personal test identifiers and the configured fail policy.
- **Meilisearch:** private master key, public search-only key scope, indexing/recovery, same-origin route, degraded behavior.
- **S3/imgproxy:** signed upload, object isolation, transformed delivery, invalid signature, CORS, lifecycle/secondary backup, and same-origin route.

### Observability and alerts

- Trigger representative app, database, disk, backup, job, payment-webhook, and reconciliation alerts.
- Confirm routing reaches the on-call destination and resolves correctly.
- Correlate browser Faro, server logs, traces, and metrics by release without PII or credentials.
- Verify dashboard/runbook links and Grafana access controls.

### Performance, E2E, and accessibility

Run the pinned Docker k6 targets only in an approved load window:

```bash
make load-staging \
  STAGING_LOAD_AUTHORIZED=I_HAVE_OWNER_AUTHORIZATION \
  STAGING_BASE_URL=https://staging.eurtisan.eu
```

The current targets are explicit provisional service objectives (`GET /` p95 < 800 ms, search p95 < 1200 ms, errors < 1%). Record environment size, image digest, dataset, VUs, duration, and results. An owner must approve or revise them after the first measured staging baseline; do not silently raise thresholds.

Run the production-realistic Playwright subset against staging with sandbox accounts, privileged 2FA, production cookie/CSRF/rate-limit settings, and no launch-critical skips. Record browser/network/console failures. Run automated axe checks plus manual keyboard, focus, screen-reader, zoom/reflow, contrast, loading/error, and checkout checks.

## Approvals and stop conditions

Final evidence requires operations, security, accessibility, privacy, and legal owner approvals. This runbook does not perform legal sign-off and must not be used to invent GPSR, withdrawal, or returns rules.

Stop qualification and mark the check `failed` or `blocked` when:

- the image/config identity differs;
- a real staging/provider account or authorization is unavailable;
- a required check would expose credentials or personal data;
- backup restore, alert routing, reconciliation, security, accessibility, or provider flow is unexercised;
- any critical E2E scenario is skipped;
- a budget is exceeded without explicit risk acceptance and rollback criteria.
