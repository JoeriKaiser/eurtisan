# Launch status

**Last reviewed:** 2026-08-09

**Current verdict:** **Pre-launch.** Application remediation and the signed staging deployment channel are operational; production launch approval has not been granted.

This document records current go-live gates. Procedures and detailed evidence requirements remain in the linked runbooks rather than being duplicated here.

## Required before production approval

### Release qualification

- [ ] Select a release-candidate Git SHA and complete the controlled evidence record in [Staging qualification](./runbooks/staging-qualification.md).
- [ ] Run the full Playwright E2E suite against the selected release candidate; focused tests and CI do not replace a current-candidate E2E run.
- [ ] Complete the production-realistic staging browser journeys with sandbox accounts, privileged 2FA, production cookie/CSRF/rate-limit behavior, and no launch-critical skips.
- [ ] Run the authorized load baseline and staging soak; retain the measured service-level evidence rather than inferring it from local or CI tests.

### Recovery and operations

- [ ] Rehearse automatic application rollback to the verified previous digest, including a forced readiness failure and recovery after removing the mutable local tag.
- [ ] Configure production off-site database and object-storage backups. `backup_offsite_rclone_remote` and `backup_s3_uploads_rclone_remote` are empty by default.
- [ ] Configure production PostgreSQL WAL archiving/PITR. `postgres_wal_archive_enabled` is false by default.
- [ ] Restore a real staging backup into an isolated database, verify critical data and encrypted-column decryption, and record RPO/RTO.
- [ ] Trigger and confirm representative application, database, disk, backup, job, webhook, reconciliation, and deployment alerts reach the accountable on-call destination and resolve correctly.
- [ ] Complete the controlled financial-discrepancy detection exercise described in [Financial reconciliation](./runbooks/financial-reconciliation.md).
- [ ] Back up the encrypted Cosign private key and Ansible Vault material, keeping the private-key password and Vault password separate.

### Security, providers, and accessibility

- [ ] Complete the sandbox/provider checks for Mollie Payments, Mollie Connect, Sendcloud, Brevo/email DNS and deliverability, VIES, Meilisearch, and S3/imgproxy.
- [ ] Complete the manual keyboard, screen-reader, reflow/zoom, forced-colors, theme, and critical-flow record in [Accessibility assurance](./ACCESSIBILITY_ASSURANCE.md). Automated axe and contrast gates are regression evidence, not manual conformance evidence.
- [ ] Mirror Caddy's Meilisearch endpoint/method restrictions in the staging Traefik route before staging is exposed beyond its IP allowlist.
- [ ] Review cookie attributes, CSRF, rate limits, trusted proxy headers, and direct-path spoofing against the deployed production image.

### Production environment and approval

- [ ] Create and configure the private Scaleway `fr-par` production image repository with separate controller push/pull and target pull-only credentials and the documented retention policy.
- [ ] Put the production registry/provider credentials and the approved `promoted_staging_image_digest` in encrypted Ansible Vault.
- [ ] Complete production DNS, transactional email DNS, provider webhooks, backup destinations, alert routing, and EU-region owner confirmation.
- [ ] Obtain product, security, accessibility, operations, privacy, and launch-owner approval in the qualification record.
- [ ] Obtain qualified legal review of cosmetics labelling for Soap & Bath. The codebase does not claim that question is settled.

## Current non-blocking engineering findings

These do not replace issue tracking and are not launch approval gates unless their impact changes:

- The no-shop fallback in `src/routes/studio/index.tsx` still contains hardcoded English and has no direct create-shop action.
- Committed Drizzle migration filenames contain duplicate numeric prefixes. The committed journal and fresh-migration gate apply cleanly; renaming files that may have reached shared environments is intentionally avoided.
- The staging VPS runs many isolated background-job containers. Consolidation is a measured capacity/maintainability improvement, not a correctness requirement.

## Status rules

- Do not describe Eurtisan as production-ready merely because CI or a public staging smoke passes.
- A gate is complete only when its evidence is recorded for the selected immutable release identity.
- Operational evidence belongs in the access-controlled qualification store, not in Git when it contains environment details or sensitive metadata.
- If this document and implementation disagree, inspect the implementation and update this document in the same change.
