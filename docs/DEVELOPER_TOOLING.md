# Developer Experience (DX) & Agent Tooling

To accelerate test validation, integration debugging, and browser automation, several tools and helper targets are exposed:

### 1. Playwright Agent CLI for Browser Automation

To enable AI agents to perform browser automation tasks, the Playwright Agent CLI (`@playwright/cli`) is installed in the project devDependencies.

Since the entire application environment is containerized, all browser automation commands must be run inside the `app` container.

A dedicated `make` target is provided for running `playwright-cli` commands:

```bash
# Run a playwright-cli command via make
make playwright-cli CMD="<command> [args]"

# Examples:
# Open browser and navigate to the application
make playwright-cli CMD="open http://localhost:3000"

# Take a snapshot of the current page to inspect the accessibility tree and element references (e.g. e1, e2)
make playwright-cli CMD="snapshot"

# Click an element (e15)
make playwright-cli CMD="click e15"

# Fill in a text input (e5)
make playwright-cli CMD="fill e5 'test-user'"

# Close all browser sessions
make playwright-cli CMD="close-all"
```

The CLI saves snapshots, screenshots, and videos directly to the local directory (which is mapped to the host). Make sure to close all active browser sessions (`make playwright-cli CMD="close-all"`) when your tasks are complete to avoid orphaned browser processes inside the container.

Playwright specs must import `waitForAppHydration` from `e2e/fixtures/hydration.ts` and call it after a full-page navigation before interacting with React controls. The helper waits for the root callback-ref signal emitted only after React commits the hydrated tree. Do not duplicate its selector or use `networkidle` as a hydration proxy. Keep a network-idle wait only when network quiescence is itself the behavior under test and no user-visible locator can express the requirement.

---

### 2. Programmatic Email Testing (Mailpit Helper)
Exposes targets to query the local `mailpit` API inside the container network to verify email flows (e.g. 2FA tokens, sign-up links, invoices) programmatically without manual scraping:
```bash
# Get the full JSON payload of the last sent email
make email-last

# Get all links/URLs extracted from the last sent email (useful to pass to playwright-cli goto)
make email-links
```

### 3. Local Search Engine Inspector (Meilisearch)
Meilisearch is accessible inside the container bridge network. Exposes a target to check index statistics:
```bash
# Retrieve Meilisearch index status, document counts, and sync state
make meili-status
```
*Note:* The Meilisearch interactive dashboard is also accessible to human developers on the host machine at `http://localhost:7700` using the API Key `meilisearch-api-key`.

### 4. Database Schema Visualizer (Drizzle Studio)
To easily view local DB records or run visual queries:
```bash
# Starts Drizzle Kit Studio
make db-studio
```
*Note:* Drizzle Studio runs inside a temporary container exposing port `4983` on the host (`http://localhost:4983`).
