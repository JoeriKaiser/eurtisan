# Eurtisan Ansible Deployment

## Prerequisites

- Ansible 2.14+
- `ansible-vault` (bundled with Ansible)
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
The current per-host build path does not by itself prove that staging and production
run the same image digest; choosing an immutable registry/artifact transport is an
infrastructure-owner decision.

## Deployment

### Staging

```bash
cd infrastructure/ansible
ansible-playbook -i inventory/staging.yml playbook.yml --vault-password-file=.vault_pass
```

### Production

```bash
cd infrastructure/ansible
ansible-playbook -i inventory/production.yml playbook.yml --vault-password-file=.vault_pass
```

## Inventory Structure

```
inventory/
├── staging.yml          # Staging host + caddy_domain
├── production.yml       # Production host + caddy_domain
└── staging.example.yml  # Template for new environments
```

## Backup Verification

A nightly cron job (`/opt/eurtisan/backup.sh`) performs the following steps:

1. **Dump** the production database via `pg_dump` and compress it with `gzip`.
2. **Test restore** the backup into a temporary PostgreSQL container.
3. **Verify integrity** by checking that critical tables (`user`, `session`, `account`, `verification`, `shop`, `category`) exist in the restored database.
4. **Prune** backups older than 7 days.

Logs are written to `/var/log/eurtisan-backup.log` as structured JSON (one object per line) compatible with Loki and other log aggregators.

### Failure Alerting

If any step fails, the script:

- Emits a structured `error` log line.
- Optionally sends a JSON payload to a webhook (e.g. Slack, Discord, PagerDuty).

Set the webhook URL in `secrets.yml`:

```yaml
backup_alert_webhook: "https://hooks.slack.com/services/..."
```

### Manual Verification

You can run the backup script manually to verify it works:

```bash
ssh root@STAGING_IP /opt/eurtisan/backup.sh
```

Then inspect the latest log entry:

```bash
ssh root@STAGING_IP tail -n 1 /var/log/eurtisan-backup.log | jq .
```

## Group Variables

```
group_vars/
├── all.yml              # Shared non-secret defaults
├── staging.yml          # Staging overrides (minimal)
└── production.yml       # Production overrides (minimal)
```

Non-secret job policy lives in `group_vars/all.yml`; this includes the six-hour read-only financial reconciliation cadence and 500-record query batch. The role renders both values and Compose starts the singleton `financial-totals-reconciliation` service automatically.

Secrets always live in **`secrets.yml`** (encrypted). Never put real secrets in `group_vars/*.yml`. Required launch secrets include database/auth encryption keys, Meilisearch master and restricted search keys, S3 and imgproxy credentials, Mollie Payments/Connect credentials, Sendcloud credentials and a dedicated webhook secret, metrics/Grafana credentials, and Brevo credentials in production.
