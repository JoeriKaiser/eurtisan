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
| Require status checks to pass | Enabled for `Quality (Lint, Test & Type Check)`, `Prometheus Rules`, `Production Image & Script Validation`, and `Ansible Syntax` |
| Require branches to be up to date | Enabled |

## CODEOWNERS

Replace `@eurtisan-maintainers` in `.github/CODEOWNERS` with your real `@org/team` or `@username`.

Production deploys: only from reviewed `main` or release tags via `deploy.sh` on the VPS.
