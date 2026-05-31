# Load tests (k6)

Target SLAs (staging baseline):

| Endpoint | p95 latency | Error rate |
|----------|-------------|------------|
| `GET /` | < 800ms | < 1% |
| `GET /search?q=pottery` | < 1200ms | < 1% |

## Run

```bash
# Install k6: https://k6.io/docs/get-started/installation/
k6 run load-tests/homepage.js
k6 run load-tests/search.js
```

Set `BASE_URL` (default `http://localhost:3000`).
