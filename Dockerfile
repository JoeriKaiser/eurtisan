# Pinned to Bun 1.3.13 to match CI and production builds.
FROM oven/bun:1.3.13@sha256:87416c977a612a204eb54ab9f3927023c2a3c971f4f345a01da08ea6262ae30e AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Lean target used by CI, where Playwright E2E is intentionally not executed.
FROM dependencies AS runtime

EXPOSE 3000

CMD ["bun", "run", "dev"]

# Default local-development target retains Playwright for explicit `make e2e` runs.
FROM runtime AS development

RUN apt-get update && \
    bunx playwright install chromium && \
    bunx playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/*
