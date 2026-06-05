# Branch protection (GitHub)

Configure on the repository **Settings → Branches → Branch protection rules** for `main`.

## Required settings

| Setting | Recommendation |
|---------|------------------|
| Require a pull request before merging | Enabled |
| Required approvals | ≥ 1 |
| Require review from Code Owners | Enabled (uses `.github/CODEOWNERS`) |
| Require status checks to pass | Enabled when CI exists (`make check`, `make test`) |
| Require branches to be up to date | Enabled |

## CODEOWNERS

Replace `@eurtisan-maintainers` in `.github/CODEOWNERS` with your real `@org/team` or `@username`.

Production deploys: only from reviewed `main` or release tags via `deploy.sh` on the VPS.
