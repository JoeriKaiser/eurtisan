# Signed release promotion and rollback

Eurtisan publishes environment-qualified application images to a private Scaleway Container Registry in `fr-par`. Ansible deploys only an immutable digest whose offline Cosign signature it has verified. GitHub Actions remains validation-only and receives no registry, signing, Vault, or VPS credential.

## One-time registry and signing setup

1. Create the private `eurtisan/app` repository in `rg.fr-par.scw.cloud` and confirm its region is `fr-par`.
2. Configure provider retention so at least two known-good generations are always retained. The launch policy is to retain all release digests for 30 days and never delete either digest named by `/opt/eurtisan/releases/current.env` or `previous.env`. Provider configuration is operational evidence; the repository cannot prove it.
3. Create separate IAM credentials:
   - controller credential: push and pull only for `eurtisan/app`;
   - target credential: pull only for `eurtisan/app`.
4. Generate an encrypted offline key on the trusted Ansible controller:

   ```bash
   mkdir -p ~/.config/eurtisan
   chmod 700 ~/.config/eurtisan
   read -rsp 'Cosign key password: ' COSIGN_PASSWORD && echo
   export COSIGN_PASSWORD
   cosign generate-key-pair --output-key-prefix ~/.config/eurtisan/cosign
   unset COSIGN_PASSWORD
   chmod 600 ~/.config/eurtisan/cosign.key ~/.config/eurtisan/cosign.pub
   ```

   Store the encrypted private key and password in separate protected backups. Do not commit either key. A future key rotation must keep the previous public key available until every retained rollback generation has expired.
5. Add `registry_push_*`, `registry_pull_*`, and `cosign_password` to encrypted Ansible Vault. Production also requires `promoted_staging_image_digest`, copied from approved staging qualification evidence.

The trusted controller requires Docker and Cosign. The VPS does not receive the signing key or Cosign binary.

## Publish and deploy

Run the canonical Make target from a clean checkout:

```bash
make infra-setup-staging
```

Ansible:

1. checks out the exact remote SHA in an isolated worktree;
2. builds the environment-qualified image with the staging public configuration;
3. pushes `staging-<full-sha>` to the private registry;
4. resolves the immutable repository digest, signs it, and verifies the signature;
5. pulls that exact digest with the target's pull-only credential;
6. verifies the local digest and OCI revision before migrations;
7. reports `repository@sha256:...` for staging evidence.

Record that digest and the compiled public-config digest in the staging qualification record. Eurtisan intentionally keeps browser-visible configuration as immutable build input, so staging and production are separately built variants of the same Git SHA. Do not claim they are byte-identical. Promotion approval covers the qualified Git SHA, staging digest, evidence, and the expected production public configuration.

For production, set the approved `promoted_staging_image_digest` in Vault and run:

```bash
make infra-setup-production
```

Production preflight rejects a missing or malformed staging digest. The production variant is independently pushed, signed, verified, and recorded.

## Automatic rollback

For the one-time transition from SSH-transferred images, first deploy the currently running Git SHA through this signed channel and verify it before attempting a newer release. The legacy image has no registry digest to verify, so Ansible intentionally cannot claim it as a verified automatic rollback generation. Schedule that cutover as a maintenance operation and do not proceed to the next release until `current.env` exists and the registry retains its digest.

Before each subsequent rollout, Ansible inspects the running image. If it has a digest in the configured release repository, Ansible verifies that signature on the controller and only then tags it `eurtisan-app:rollback-before-deploy` on the target.

Migration, server-configuration, startup, readiness, and background-service failures enter Ansible's rescue path. It restores every application service to that verified digest, waits for readiness, restores release metadata, and exits non-zero. Image rollback never reverses a database migration. Treat a migration failure as an incident and follow the database recovery plan in [Deployment](../DEPLOYMENT.md#migration-rollback-plan).

Successful deployments write mode-0600 records:

- `/opt/eurtisan/releases/current.env`
- `/opt/eurtisan/releases/previous.env`

The retained VPS `deploy.sh` is an emergency recovery tool only. It accepts a local image only when its OCI revision and repository digest match Ansible-managed metadata; it does not build, sign, or qualify releases.

## Rehearsal and key rotation

Before launch and after changing this channel:

- deploy a backward-compatible staging release;
- force readiness failure and confirm automatic rollback reaches healthy state;
- remove the mutable release tag locally and prove recovery still works from the retained registry digest;
- verify both release records refer to registry-retained digests;
- record timings and redacted evidence under `resilience.rollback`.

Rotate registry credentials independently. For signing-key rotation, trust both old and new public keys during the overlap, re-sign retained release digests with the new key, exercise rollback, then retire the old key.
