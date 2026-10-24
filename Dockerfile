# syntax=docker/dockerfile:1
# Pinned to Bun 1.4.3 to match CI and production builds.
FROM oven/bun:1.4.3@sha256:ec06c3b6cea04192ae6770c434f668ca41d343ad19fa6472216c7b48be39c598 AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

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
