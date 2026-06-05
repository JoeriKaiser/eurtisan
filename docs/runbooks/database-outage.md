# Database Outage

## Symptoms

- `/api/health/ready` returns 503; `database: unhealthy`
- Checkout and sign-in return 5xx
- Loki: `connection`, `ECONNREFUSED`, or pool timeout errors from `service=eurtisan`

## Immediate actions

1. Confirm Postgres container: `docker compose -f docker-compose.prod.yml ps db`
2. Check disk on VPS: `df -h` (full disk prevents Postgres start)
3. Inspect logs: `docker compose -f docker-compose.prod.yml logs --tail=200 db`
4. If Postgres is down, restart: `docker compose -f docker-compose.prod.yml restart db`
5. Wait for `pg_isready`, then restart app: `docker compose -f docker-compose.prod.yml restart app`

## Recovery

- If data corruption suspected, follow [backup-restore.md](./backup-restore.md)
- Communicate RTO/RPO per `docs/DEPLOYMENT.md#recovery-objectives-rto--rpo`

## Post-incident

- Capture timeline in incident channel
- Review connection pool settings and slow queries
