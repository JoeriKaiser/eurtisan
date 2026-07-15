# Branch protection (GitHub)

GitHub is the canonical repository and the required review/CI checks should be
configured there. Codeberg is a read-only mirror for source availability.

Configure on the repository **Settings → Branches → Branch protection rules** for `main`.

## Required settings

| Setting | Recommendation |
|---------|------------------|
| Require a pull request before merging | Enabled |
| Required approvals | ≥ 1 |
| Require review from Code Owners | Enabled (uses `.github/CODEOWNERS`) |
| Require status checks to pass | Enabled for `Quality, Migrations, Tests & Build`, `Production Image Smoke`, `Compose, Workflow, Shell & Ansible`, and `Prometheus Rules` |
| Require branches to be up to date | Enabled |

## CODEOWNERS

Replace `@eurtisan-maintainers` in `.github/CODEOWNERS` with your real `@org/team` or `@username`.

Production deploys: only from reviewed `main` or release tags via `deploy.sh` on the VPS.

Branch protection is external owner-managed state. After changing CI job names, an owner must update the required checks and record that verification; repository-local validation cannot prove the GitHub ruleset is active.
