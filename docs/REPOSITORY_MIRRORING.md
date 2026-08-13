# Repository mirroring

GitHub is the canonical Eurtisan repository. Codeberg is a source mirror and
is not the pull-request or deployment source.

```txt
Canonical: https://github.com/JoeriKaiser/eurtisan
Mirror:    https://codeberg.org/kaiser/eurtisan
```

## Configure an existing checkout

This changes only the local remote names and URLs; it does not change either
hosting account:

```bash
git remote rename origin codeberg
git remote rename mirror origin
git remote set-url origin git@github.com:JoeriKaiser/eurtisan.git
git remote set-url codeberg git@codeberg.org:kaiser/eurtisan.git
```

After this, `origin` is GitHub and `codeberg` is the mirror. Push the same
reviewed branches and tags to both remotes when updating the mirror:

```bash
git push origin main --tags
git push codeberg main --tags
```

Codeberg does not provide a general pull-mirror service for repositories hosted
elsewhere. Keeping the mirror current therefore requires an explicit second
push, a local automation wrapper, or a scheduled mirror job. Do not accept
independent changes on the mirror, or it can diverge from GitHub.

GitHub pull requests and GitHub Actions are tied to the GitHub repository. A
pull request opened on Codeberg will not trigger the GitHub workflow.
