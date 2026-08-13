# Backup and point-in-time recovery

## Recovery model

Eurtisan keeps two independent PostgreSQL recovery formats:

1. A nightly GPG-encrypted custom-format logical dump in
   `/opt/eurtisan/backups/logical/eurtisan-YYYYMMDD-HHMMSS.dump.gpg`. It is
   decrypted as a stream, restored into a disposable PostgreSQL 16 container,
   and checked for critical tables before it is considered successful.
2. Encrypted pgBackRest physical backups plus continuous WAL archiving. Staging
   uses an encrypted local repository to exercise the mechanism. Production is
   blocked by Ansible preflight unless pgBackRest and logical/upload replication
   point at configured S3-compatible off-site storage.

Logical dumps provide portability. pgBackRest is the source for point-in-time
recovery (PITR). PostgreSQL WAL cannot be applied to a logical `pg_dump`.

## Recovery keys

Sensitive database columns are encrypted with `DATABASE_ENCRYPTION_KEY`. Logical
dumps use `backup_logical_cipher_pass`, the pgBackRest repository has a separate
`pgbackrest_repo_cipher_pass`, and off-site filenames/content receive an additional
rclone crypt layer using `backup_rclone_crypt_password`.

- Keep protected recovery copies of all four values outside the database host.
- Losing `DATABASE_ENCRYPTION_KEY` makes encrypted application columns
  unrecoverable even when PostgreSQL restores successfully.
- Losing a backup encryption passphrase makes the corresponding backup format
  unrecoverable.
- Never store a repository passphrase in the same bucket as its encrypted data.

## Schedule and retention

| Artifact | Schedule | Default retention |
| --- | --- | --- |
| Logical custom-format dump | Daily, 03:00 UTC | 30 days local, 90 days off-site |
| pgBackRest differential | Daily, 02:00 UTC | 14 differential backups |
| pgBackRest full | Sunday, 01:00 UTC | 4 full backup sets |
| WAL | Continuous; inactive segments switch after 15 minutes | Owned by pgBackRest backup retention |

Systemd timers are persistent, so a missed run starts after the host returns.
Inspect them with:

```bash
systemctl list-timers 'eurtisan-*backup*'
systemctl status eurtisan-logical-backup.timer
systemctl status eurtisan-pgbackrest-diff.timer
journalctl -u eurtisan-logical-backup.service
```

The combined structured log remains at `/var/log/eurtisan-backup.log`.

## Manual backup operations

```bash
# Verified logical dump
sudo systemctl start eurtisan-logical-backup.service

# Physical backups when pgBackRest is enabled
sudo -u eurtisan-backup /opt/eurtisan/pgbackrest-backup.sh diff
sudo -u eurtisan-backup /opt/eurtisan/pgbackrest-backup.sh full

# Repository and WAL checks
docker exec --user postgres eurtisan-db-staging \
  pgbackrest --stanza=eurtisan info
docker exec --user postgres eurtisan-db-staging \
  pgbackrest --stanza=eurtisan check
docker exec eurtisan-db-staging psql -U eurtisan -d eurtisan -x -c \
  'SELECT * FROM pg_stat_archiver;'
```

Use `eurtisan-db` instead of `eurtisan-db-staging` in production.

## Logical restore verification

Never pipe a dump into the existing production database. Restore into a new,
isolated PostgreSQL 16 instance first:

```bash
set -a
source /etc/eurtisan/backup.env
set +a
BACKUP=/opt/eurtisan/backups/logical/eurtisan-YYYYMMDD-HHMMSS.dump.gpg
sha256sum --check "$BACKUP.sha256"

docker run -d --rm --name eurtisan-logical-restore \
  --network none \
  -e POSTGRES_USER=verify \
  -e POSTGRES_PASSWORD=verify-only \
  -e POSTGRES_DB=verify_restore \
  postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229

until docker exec eurtisan-logical-restore \
  pg_isready -U verify -d verify_restore; do sleep 2; done

gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt "$BACKUP" 3<<<"$BACKUP_LOGICAL_CIPHER_PASS" | \
  docker exec -i eurtisan-logical-restore pg_restore \
    -U verify -d verify_restore --exit-on-error --no-owner --no-privileges

docker exec eurtisan-logical-restore psql -U verify -d verify_restore -c \
  'SELECT COUNT(*) FROM "user"; SELECT COUNT(*) FROM shop; SELECT COUNT(*) FROM platform_order;'
```

Destroy the isolated container after recording non-sensitive verification
results. A production cutover requires a new database volume and an approved
maintenance window; preserve the old volume until the restored service is
qualified.

## Point-in-time recovery drill

`make pgbackrest-check` performs a disposable full-backup/WAL/PITR integration
test locally. Release qualification additionally requires a real staging drill:

1. Record the immutable release and backup set shown by `pgbackrest info`.
2. Create a uniquely identified marker row and force a WAL switch with
   `SELECT pg_switch_wal()`.
3. Record a UTC recovery target after the marker commit.
4. Make a second distinguishable change and force another WAL switch.
5. Stop application writers and PostgreSQL.
6. Restore into a **new empty volume**, never over the source volume.
7. Start the restored database in isolation and verify that the first change is
   present and the second is absent.
8. Start the application with the exact `DATABASE_ENCRYPTION_KEY` used by the
   backup and verify authorized encrypted-column reads.
9. Record measured RPO/RTO and destroy the clone.

The core restore command, run with the database stopped and an empty PGDATA, is:

```bash
pgbackrest --stanza=eurtisan \
  --type=time \
  --target='YYYY-MM-DD HH:MM:SS.US+00' \
  --target-action=promote \
  restore
```

Use the Ansible-managed pgBackRest image, configuration, repository mounts, and
`/etc/eurtisan/pgbackrest.env`. Do not improvise a restore against the live
Compose volume. The validated disposable orchestration is implemented in
`scripts/validate-pgbackrest.sh` and should be adapted with an explicitly named
new volume for the staging drill.

## Monitoring

`eurtisan-backup-status.timer` reports persisted completion timestamps and
PostgreSQL archive status every five minutes. Prometheus alerts cover:

- missing five-minute backup status reports;
- any reported backup failure;
- logical backup older than 26 hours;
- differential physical backup older than 30 hours;
- full physical backup older than eight days;
- increases in `pg_stat_archiver.failed_count`;
- completed WAL files waiting more than 20 minutes.

A successful script with no received report is not sufficient evidence. Confirm
metrics and the accountable alert destination during staging qualification.

## Uploads and search recovery

When off-site backup is configured, rclone reads the primary uploads bucket with
a dedicated read-only credential and writes an encrypted replica without deleting
destination objects. Destination versioning/Object Lock preserves overwritten
versions, source-deleted objects remain until lifecycle expiration, and provider
lifecycle rules own the 90-day retention.

PostgreSQL remains the source of truth for search. Rebuild Meilisearch after a
database restore rather than treating an asynchronously requested dump as a
verified backup:

```bash
docker compose -f docker-compose.prod.yml run --rm app bun run search:reindex
```
