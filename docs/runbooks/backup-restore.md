# Backup Restore

## Nightly backups

- Location: `/opt/eurtisan/backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz`
- Schedule: 03:00 UTC (see Ansible cron)
- Retention: 7 days on VPS

## Restore procedure

```bash
ssh ubuntu@PROD_HOST
cd /opt/eurtisan
docker compose -f docker-compose.prod.yml stop app
gunzip -c backups/eurtisan-YYYYMMDD-HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db psql -U eurtisan -d eurtisan
docker compose -f docker-compose.prod.yml start app
```

## Point-in-time recovery (WAL)

When WAL archiving to object storage is configured (see `docs/DEPLOYMENT.md`), use `pg_basebackup` + WAL replay for RPO &lt; 1 hour. Document exact commands in your object-storage provider runbook.

## Verification

- Row counts for `user`, `platform_order`, `shop`
- Smoke test checkout on staging clone before production cutover
