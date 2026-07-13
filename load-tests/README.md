# Staging load qualification (k6)

Provisional service objectives pending the first owner-reviewed EU staging baseline:

| Endpoint | Virtual users | Duration | p95 latency | Error rate |
|---|---:|---:|---:|---:|
| `GET /` | 10 | 30s | < 800ms | < 1% |
| `GET /search?q=ceramic` | 5 | 30s | < 1200ms | < 1% |

The values are explicit launch objectives, not measured staging evidence. Record the image digest, environment size, dataset, VUs, duration, and k6 summary during qualification. After the first baseline, approve or revise the objectives in review; never raise them only to make a failed run pass.

Run only after the owner authorizes a load window:

```bash
make load-staging \
  STAGING_LOAD_AUTHORIZED=I_HAVE_OWNER_AUTHORIZATION \
  STAGING_BASE_URL=https://staging.eurtisan.eu
```

The Make target uses a digest-pinned k6 container. It does not read credentials and should target only the public staging origin. See [`docs/runbooks/staging-qualification.md`](../docs/runbooks/staging-qualification.md).
