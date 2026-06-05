# Disk Full

## Symptoms

- Health check `disk: unhealthy` (below 500 MB free on `/opt/eurtisan`)
- Backup cron failures in `/var/log/eurtisan-backup.log`
- Postgres cannot write WAL

## Immediate actions

1. `df -h` and `du -sh /opt/eurtisan/* | sort -h`
2. Prune old Docker images cautiously: `docker system df`
3. Remove backups older than retention policy from `/opt/eurtisan/backups/` **only** if another copy exists off-VPS
4. Restart affected services after freeing ≥1 GB

## Prevention

- Off-site backup copy (see `docs/DEPLOYMENT.md`)
- WAL archiving to object storage when enabled
