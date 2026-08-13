# Eurtisan Ansible Deployment

## Prerequisites

- Ansible 2.14+
- `ansible-vault` (bundled with Ansible)
- Docker and Cosign running on the trusted Ansible controller
- SSH access to the target server(s)

## Secrets Management

All sensitive values (passwords, API keys, tokens) are stored in **`secrets.yml`**, which is encrypted with **Ansible Vault**.

### Vault Password

The vault password is stored in `.vault_pass` (`.gitignore`-d, never committed).
The `.vault_pass` file in the repository is a placeholder; create it locally with
the real password before running any Ansible command.

If you need to share the password with a team member, use a secure channel (1Password, Bitwarden Send, etc.). Do not paste it in Slack or email.

### Editing Secrets

```bash
# Decrypt, open in $EDITOR, then re-encrypt
ansible-vault edit secrets.yml --vault-password-file=.vault_pass

# Or decrypt to a temp file, edit, then re-encrypt
ansible-vault decrypt secrets.yml --vault-password-file=.vault_pass
cp secrets.yml secrets.yml.decrypted
# ... edit ...
ansible-vault encrypt secrets.yml.decrypted --vault-password-file=.vault_pass
mv secrets.yml.decrypted secrets.yml
```

### Viewing Secrets (without editing)

```bash
ansible-vault view secrets.yml --vault-password-file=.vault_pass
```

### Rotating the Vault Password

```bash
# Re-key with a new password
ansible-vault rekey secrets.yml --vault-password-file=.vault_pass --new-vault-password-file=.vault_pass.new
```

## SSH Host Key Verification

Ansible defaults to strict SSH host key checking (`host_key_checking = True`). This protects against man-in-the-middle attacks but requires the target host's key to be present in `known_hosts` before a playbook runs.

### CI / automated deployments

Populate `known_hosts` before the playbook runs:

```bash
ssh-keyscan -H "$(yq '.all.hosts | keys | .[0]' inventory/staging.yml)" >> ~/.ssh/known_hosts 2>/dev/null
```

Replace `staging.yml` with `production.yml` as needed.

### First run from a new local machine

Accept the host key on the first connection only, then rely on normal verification afterward:

```bash
ansible-playbook -i inventory/staging.yml playbook.yml --vault-password-file=.vault_pass --ssh-extra-args='-o StrictHostKeyChecking=accept-new'
```

### Pre-task alternative

The playbook includes a pre-task that adds each target host to `known_hosts` automatically. If you prefer to manage keys yourself, remove the `known_hosts` pre-task from `playbook.yml`.

## Configuration preflight

The role validates required variable names, formats, integration modes, and
cross-field constraints before provisioning or container startup. Failures identify
variable names without printing their values. To validate an inventory without
changing a host, supply the encrypted Vault variables and run:

```bash
ansible-playbook -i inventory/staging.yml preflight.yml \
  -e @secrets.yml --vault-password-file=.vault_pass
```

Browser-visible values are built into the image. A `VITE_*` change therefore needs
an image rebuild; server-only secret changes need recreation of all consuming
containers. See `../../docs/runbooks/environment-configuration.md` for ownership and
rotation procedures. Repository-local syntax, synthetic preflight, and template
validation runs through `make ansible-check`; it does not access Vault or a host.

Before promoting a qualified release, follow
[`../../docs/runbooks/staging-qualification.md`](../../docs/runbooks/staging-qualification.md).
The playbook builds the exact release SHA in a clean temporary worktree on the trusted
controller and publishes the environment-qualified variant to the environment's
private registry. Staging uses the authenticated registry that Ansible manages on the
existing staging VPS; production uses Scaleway Container Registry in `fr-par`.
The VPS never compiles application source and receives only a pull-only registry
credential during deployment. The edge proxy is a stock digest-pinned
`caddy:2-alpine` image (the Caddyfile uses core directives only, so no custom
proxy build exists). Production preflight requires the approved
staging digest. Follow
[`../../docs/runbooks/release-promotion-and-rollback.md`](../../docs/runbooks/release-promotion-and-rollback.md)
for registry retention, signing-key setup, promotion, and rollback rehearsal.

## Deployment

### Staging

```bash
make infra-setup-staging
```

### Production

```bash
make infra-setup-production
```

Run these from the repository root so the controller can create a clean Git worktree
for the remote release SHA and reuse its local Docker build cache.

## Inventory Structure

```
inventory/
├── staging.yml          # Staging host + caddy_domain
├── production.yml       # Production host + caddy_domain
└── staging.example.yml  # Template for new environments
```

## Backup Verification

Systemd timers replace the old cron job. A nightly logical backup writes a
PostgreSQL custom-format dump, records a checksum, restores it into a disposable
PostgreSQL 16 container, and checks critical tables before retention or upload.
Encrypted pgBackRest full/differential backups provide the physical base backups
required for continuous WAL/PITR.

Staging uses `pgbackrest_repository_type: posix` to exercise local PITR. Production
uses `s3` and preflight rejects missing remote repository, rclone encryption, or
least-privilege credential values. The controller builds the pinned pgBackRest
database image from the clean release worktree and transfers it over Ansible; the
VPS does not build it.

Logs are written to `/var/log/eurtisan-backup.log`. Backup status is reported every
five minutes so Prometheus can alert on stale backups, WAL failures, and archive
backlog as well as explicit job failures.

Manual verification:

```bash
sudo systemctl start eurtisan-logical-backup.service
sudo -u eurtisan-backup /opt/eurtisan/pgbackrest-backup.sh diff
docker exec --user postgres eurtisan-db-staging pgbackrest --stanza=eurtisan check
systemctl list-timers 'eurtisan-*backup*'
tail -n 20 /var/log/eurtisan-backup.log
```

Use `make pgbackrest-check` for a disposable full backup, WAL archive, and
time-targeted restore. Follow
[`../../docs/runbooks/backup-restore.md`](../../docs/runbooks/backup-restore.md) for
the real staging qualification drill.

## Group Variables

```
group_vars/
├── all.yml              # Shared non-secret defaults
├── staging.yml          # Staging overrides (minimal)
└── production.yml       # Production overrides (minimal)
```

Non-secret job policy lives in `group_vars/all.yml`; this includes the six-hour read-only financial reconciliation cadence and 500-record query batch. The role renders both values and Compose starts the singleton `financial-totals-reconciliation` service automatically.

Secrets always live in **`secrets.yml`** (encrypted). Never put real secrets in `group_vars/*.yml`. One Vault serves both environments: staging values carry a `_staging` suffix and `group_vars/staging.yml` maps them to the canonical names, while production owns the canonical names directly. Start production from `secrets.production.example.yml`. Required launch secrets include database/auth encryption keys, Meilisearch master and restricted search keys, S3 and imgproxy credentials, separate staging registry push/pull credentials plus its internal HTTP secret, the Cosign key password, Mollie Payments/Connect credentials, Sendcloud credentials and a dedicated webhook secret, metrics/Grafana credentials, and Brevo credentials in production. Backup secrets include the pgBackRest repository cipher passphrase, rclone crypt password, separate pgBackRest/logical-backup writers, and a read-only primary-uploads replication key. Production additionally needs separate registry IAM credentials, alert receiver credentials, and records the approved staging digest in Vault.
