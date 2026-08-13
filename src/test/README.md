# Test Utilities

This directory contains shared utilities for unit and integration tests.

## Factories

`src/test/factories/` provides deterministic, type-safe helpers for creating database rows in tests. Import from the barrel:

```ts
import { createUser, createShop, createProduct } from '#/test/factories'
```

Each factory accepts an optional `overrides` object that is spread over the defaults, so any column can be replaced.

```ts
const buyer = await createUser({ name: 'Alice' })
const shop = await createShop(buyer, { status: 'active' })
const product = await createProduct(shop, { priceCents: 2999, stockCount: 5 })
```

Foreign-key arguments accept either an entity object or an ID string:

```ts
await createShop(owner.id)
await createProduct(shop.id)
```

### Available factories

- `core.ts` — users, shops, categories, products, product images, variants.
- `orders.ts` — platform orders, shop orders, order items, inventory reservations, shipping labels.
- `financial.ts` — payouts, invoices.
- `engagement.ts` — carts, cart items, reviews, disputes, dispute messages, notifications.

## Scenarios

`src/test/scenarios.ts` composes factories into common business states:

```ts
import { createPaidOrder } from '#/test/scenarios'

const { buyer, shop, product, platformOrder, shopOrder, orderItem } = await createPaidOrder()
```

## Cleanup

`src/test/cleanup.ts` provides `clearTestTables()`, which deletes all rows from every application table in FK-child-first order. Use it in `beforeEach`:

```ts
import { clearTestTables } from '#/test/cleanup'

beforeEach(async () => {
  await clearTestTables()
})
```

## Adding a new factory

1. Add the function to the appropriate domain file in `src/test/factories/`.
2. Use `crypto.randomUUID()` for generated IDs and unique-required fields.
3. Return the full selected row.
4. Export it from `src/test/factories/index.ts`.
5. Add a test in `src/test/factories.test.ts`.
6. If the factory creates rows in a new table, add that table to `clearTestTables()` in `src/test/cleanup.ts`.
