# Backup Restore

## Application encryption key

Sensitive columns (`account.accessToken`, `account.refreshToken`, `account.idToken`,
`account.password`, `two_factor.secret`, `two_factor.backupCodes`,
`shop.mollieAccessToken`, `shop.mollieRefreshToken`) are encrypted at rest with
AES-256-GCM using `DATABASE_ENCRYPTION_KEY`.

- The key must be a 256-bit value encoded as base64 (32 bytes when decoded).
- Generate with: `openssl rand -base64 32`
- Store the key in the deployment secrets (Ansible `secrets.yml`), not in the
  repository or plain `.env` files.
- Backups contain ciphertext; they are safe to retain, but **losing the key makes
  the encrypted data unrecoverable**. Keep an off-site, access-controlled copy
  of the key separate from the database backups.
- When restoring a backup, ensure `DATABASE_ENCRYPTION_KEY` is set to the exact
  key that was active when the backup was taken. If the key has been rotated
  since the backup, you may need to re-encrypt after restore.

## Nightly backups

- Location: `/opt/eurtisan/backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz`
- Schedule: 03:00 UTC (see Ansible cron)
- Local retention: 30 days (`BACKUP_RETENTION_DAYS`)
- Off-site retention: 90 days (`BACKUP_OFFSITE_RETENTION_DAYS`) when `BACKUP_OFFSITE_RCLONE_REMOTE` is configured
- Verification: every backup is restored into a temporary container and checked for expected tables

## Restore procedure

```bash
ssh ubuntu@PROD_HOST
cd /opt/eurtisan
docker compose -f docker-compose.prod.yml stop app
gunzip -c backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U eurtisan -d eurtisan
docker compose -f docker-compose.prod.yml start app
```

After restore, run the deploy smoke tests manually:

```bash
docker compose -f docker-compose.prod.yml exec -T app curl -fsS http://localhost:3000/api/health/ready
docker compose -f docker-compose.prod.yml exec -T app curl -fsS http://localhost:3000/api/health/live
docker compose -f docker-compose.prod.yml exec -T app curl -fsS http://localhost:3000/api/health
```

## Point-in-time recovery (WAL)

When WAL archiving is enabled (`POSTGRES_WAL_ARCHIVE_ENABLED=true`), WAL segments are copied to the configured archive path. For S3-compatible object storage, use `wal-g` or `pgbackrest`; for the default local path, replay WAL manually:

```bash
# Stop the app and the existing DB container
docker compose -f docker-compose.prod.yml stop app db

# Start a recovery container with the base backup and WAL archive mounted
docker run --rm -it \
  -v eurtisan_postgres_data:/var/lib/postgresql/data \
  -v /opt/eurtisan/backups/wal:/wal:ro \
  -e POSTGRES_USER=eurtisan \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB=eurtisan \
  postgres:16-alpine \
  postgres -c recovery_target_time='YYYY-MM-DD HH:MM:SS UTC' \
           -c restore_command='cp /wal/%f %p'
```

For exact object-storage commands, see your provider's `wal-g`/`pgbackrest` runbook. Test this procedure quarterly on a staging clone.

## Backup metrics

The backup script reports success/failure to `POST /api/backup-report`. The endpoint is protected by `BACKUP_REPORT_TOKEN` (falls back to `METRICS_TOKEN`). Prometheus exposes:

- `eurtisan_backup_success_total` — successful backup reports
- `eurtisan_backup_failures_total` — failed backup reports

If the backup script cannot reach `/api/backup-report`, the failure is still logged and alerted via `BACKUP_ALERT_WEBHOOK`/`DEPLOY_ALERT_WEBHOOK`, but the Prometheus counters will not update.

## Verification

- Row counts for `user`, `platform_order`, `shop`
- Disk free space after restore
- Smoke test checkout on staging clone before production cutover
- `eurtisan_backup_success_total` increments after a successful nightly run

## Meilisearch & S3 uploads recovery

- Meilisearch dumps are stored alongside database backups (`/opt/eurtisan/backups/meilisearch-YYYYMMDD-HHMMSS/`). Recreate indexes from a dump with `meilisearch --import-dump <path>`.
- S3 uploads are synced off-site when `BACKUP_S3_UPLOADS_RCLONE_REMOTE` is configured. Restore from the off-site copy using `rclone sync` back to the primary bucket.
