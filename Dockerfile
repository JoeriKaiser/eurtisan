FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

# Install system dependencies for Playwright Chromium
RUN apt-get update && \
    bunx playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD ["bun", "run", "dev"]
