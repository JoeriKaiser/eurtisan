# Sendcloud Integration Plan

> Provisional plan for replacing the mocked Mondial Relay shipping provider with a real Sendcloud integration.
>
> This document captures the webhook URL we have already registered in the Sendcloud dashboard so it can be implemented safely later.

## Provisional webhook URL

Use the following URL in the Sendcloud dashboard for status and tracking updates:

```text
${PUBLIC_URL}/api/webhooks/sendcloud
```

Concrete examples per environment:

| Environment | Webhook URL |
|-------------|-------------|
| Production  | `https://eurtisan.eu/api/webhooks/sendcloud` |
| Staging     | `https://staging.eurtisan.eu/api/webhooks/sendcloud` |
| Local dev   | `https://localhost:3000/api/webhooks/sendcloud` (requires a public tunnel such as ngrok for Sendcloud to reach it) |

`PUBLIC_URL` is the canonical public URL of the application, already used for SSR, emails, and absolute links (see `src/lib/env.server.ts`).

The path `/api/webhooks/sendcloud` follows the existing webhook convention used by `/api/webhooks/mollie` and `/api/webhooks/brevo`.

## Why this URL is safe to register now

- The route does not exist yet, but registering it in Sendcloud only means Sendcloud will attempt deliveries once the endpoint is live.
- Until the endpoint is implemented, any delivery attempts will return `404` and can be retried later.
- The path is reserved by convention and will not be used for anything else.

## Implementation checklist

- [ ] Create `src/routes/api/webhooks/sendcloud.ts` to receive Sendcloud parcel status webhooks.
- [ ] Verify webhook authenticity using Sendcloud signature / secret mechanism.
- [ ] Update `shopOrder` and `shippingLabel` records based on incoming tracking events.
- [ ] Emit appropriate order-status transitions (e.g. `shipped`, `out_for_delivery`, `delivered`).
- [ ] Add `SENDCLOUD_API_KEY`, `SENDCLOUD_API_SECRET`, and `SENDCLOUD_WEBHOOK_SECRET` to environment variables and deployment secrets.
- [ ] Implement `src/integrations/shipping/sendcloud-provider.ts` replacing `MondialRelayProvider`.
- [ ] Wire the new provider into the shipping abstraction (`src/lib/shipping-provider.ts`).
- [ ] Remove or deprecate the mocked Mondial Relay provider in production.
- [ ] Add tests for the webhook handler and provider.
- [ ] Update `AGENTS.md` to remove the Sendcloud blocker once complete.

## Related files

- `src/lib/shipping-provider.ts` — shipping provider interface.
- `src/integrations/shipping/mondial-relay-provider.ts` — current mocked provider.
- `src/integrations/shipping/index.ts` — provider exports.
- `src/routes/api/webhooks/mollie.ts` — existing webhook pattern to mirror.
- `src/lib/env.server.ts` — `getBaseUrl()` and environment helpers.
