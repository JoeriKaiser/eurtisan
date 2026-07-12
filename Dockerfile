# Pinned to Bun 1.3.13 to match CI and production builds.
FROM oven/bun:1.3.13@sha256:87416c977a612a204eb54ab9f3927023c2a3c971f4f345a01da08ea6262ae30e

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Install Playwright Chromium browser and its system dependencies for E2E tests.
RUN apt-get update && \
    bunx playwright install chromium && \
    bunx playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD ["bun", "run", "dev"]
