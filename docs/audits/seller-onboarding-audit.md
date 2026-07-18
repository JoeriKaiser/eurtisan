# Seller shop creation and onboarding audit

**Status:** Complete
**Last updated:** 2026-07-16
**Scope:** Seller Hub, shop-creation wizard, moderation status, approval-to-activation handoff, and first-shop readiness.

## Confirmed product decisions

- [x] A shop is only “live” when its first listing is publicly visible and purchasable.
- [x] Digital downloads are not in launch scope and must not be offered during onboarding.
- [x] Optimize for the fastest valid shop: five outcome-based stages, with optional storefront enrichment deferred until after submission.

## Target journey

1. **Shop profile**: name, canonical URL, category, physical production model, description, required shop icon.
2. **Seller details**: dispatch location, legal identity, business address, VAT/DAC7 data, security and payment expectations.
3. **First product**: complete sale-critical physical-product data, images, category, VAT category, stock, weight, and dimensions.
4. **Delivery and policies**: processing window, delivery reach, legally guided returns/exchanges, custom-order terms.
5. **Preview and submit**: authoritative server readiness, buyer-view preview, one submission action, and explicit review/payment/2FA launch sequence.

## P1: Trust, persistence, and activation

- [x] Replace the false “Saved” state with accurate dirty, saving, saved, and save-failed states.
- [x] Persist edits reliably and prevent accidental loss through Save & Exit, global navigation, refresh, or interruption.
- [x] Make Save & Exit leave only after a successful save; surface validation/save failures without discarding work.
- [x] Make onboarding progress unambiguous and resume the first incomplete stage rather than the last completed stage.
- [x] Keep progress and review data fresh after every save.
- [x] Make first-product persistence idempotent so revisiting a stage updates rather than duplicates the product.
- [x] Ensure the first product becomes published and active exactly when the approved, payment-connected shop becomes active.
- [x] Prevent a shop from being described as live unless it has a published, active, purchasable listing.
- [x] Replace the hard-coded review checklist with authoritative server-side readiness checks.
- [x] Store seller-term acceptance with timestamp and terms version.
- [x] Require all visible submission requirements on the server, not only tax identity and listing existence.
- [x] Replace the competing “Submit for Review” and “Open My Shop” actions with one accurate action.
- [x] Add clear user-facing handling for create, save, slug, upload, and submission failures.

## P1: Flow structure and expectation management

- [x] Reduce the wizard from eight rigid steps to the five confirmed outcome-based stages.
- [x] Add a concise start/preparation screen or first-stage introduction covering time, required information, fees, review, payment/KYC, and 2FA.
- [x] Remove digital downloads from onboarding choices and validation.
- [x] Defer optional banner, socials, languages, tags, and announcements to post-submission shop enrichment.
- [x] Explain why sensitive tax/legal data is collected, how it is used, and where privacy information can be reviewed.
- [x] Collect the legal/business address needed for seller disclosures before activation.
- [x] Explain payment connection and 2FA before submission rather than after approval.
- [x] Add a post-approval launch checklist covering 2FA, Mollie, first-product publication, storefront preview, and go-live confirmation.
- [x] Add a post-activation readiness checklist for optional branding and growth tasks.

## P1: Field and business-rule correctness

- [x] Show the actual canonical public path (`/shops/{slug}`), not `/shop/{slug}`.
- [x] Permit European characters in shop names and normalize them safely for generated slugs.
- [x] Replace believable placeholder defaults such as “My Shop” with clearly incomplete draft values.
- [x] Treat a known-taken slug as a blocking field error and recover cleanly from server conflicts.
- [x] Replace unrestricted language/tag inputs in the mandatory path by deferring them to settings.
- [x] Add useful production-partner disclosure copy.
- [x] Add image file-type feedback, storefront-context previews, and reliable image URL resolution.
- [x] Replace the incomplete country list with the supported European launch market list and localizable labels.
- [x] Persist and rehydrate VAT and tax-identity fields correctly.
- [x] Add meaningful date-of-birth constraints and country-appropriate identity guidance.
- [x] Remove duplicate VAT copy and split shipping, VAT, and identity into clear groups.
- [x] Correct the processing-time layout at all viewport widths.
- [x] Replace misleading policy presets; do not offer meaningless 14/30-day custom-order choices.
- [x] Ensure exchange/return choices are persisted exactly as presented.
- [x] Explain that seller policies cannot override mandatory consumer rights.
- [x] Avoid defaulting creators into a potentially misleading “returns not accepted” policy without context.
- [x] Remove the unsupported social-handle input from the mandatory journey; keep normalized full-URL socials in settings.
- [x] Make the first-product form sale-ready with product category, VAT category, weight, and dimensions.
- [x] Include the first product in review and buyer preview.

## P1/P2: Seller Hub and status lifecycle

- [x] Improve the Seller Hub empty state with preparation guidance and a contextual first-shop action.
- [x] Add draft deletion from the Seller Hub and make the visible draft limit consistent with the server limit.
- [x] Replace `window.confirm` multi-shop behavior with an accessible, intentional interaction or remove the mismatched warning.
- [x] Ensure creator-role promotion does not create a confusing security dead end.
- [x] Send in-app and seller-email notifications for approval, changes requested, and rejection as promised.
- [x] Make moderator feedback actionable and link it to the affected onboarding stage where possible.
- [x] Add useful actions to pending, rejected, suspended, approved, and active status states.
- [x] Remove purple and hard-coded status colors; use Eurtisan semantic tokens in light and dark themes.
- [x] Preserve the selected shop when navigating to the creator dashboard or payment setup.

## Accessibility and responsive quality

- [x] Give production-model and policy choices real radio-group semantics and announced selected state.
- [x] Give processing-time minimum and maximum inputs individual accessible names and connected errors.
- [x] Connect every validation message with `aria-invalid`, `aria-describedby`, and stable IDs.
- [x] Focus the first invalid field or an accessible error summary after failed continuation.
- [x] Bring onboarding switches, progress controls, checkboxes, and icon actions to 44px touch targets.
- [x] Auto-scroll or redesign the mobile progress indicator so the active stage remains visible.
- [x] Keep the primary action reachable on mobile without obscuring fields or the software keyboard.
- [x] Remove duplicate view-transition names and verify reduced-motion behavior.
- [x] Verify keyboard-only completion, 200% zoom/reflow, screen-reader names, and light/dark contrast.

## Localization and content

- [x] Move all Seller Hub, onboarding, status, validation, and async-state copy into Paraglide messages.
- [x] Provide complete English and Dutch coverage for the revised journey.
- [x] Use translation-safe full sentences and layouts that tolerate at least 30% text expansion.
- [x] Replace unsupported marketing claims with evidence-based or neutral guidance.
- [x] Use accurate outcome-based labels: “Save draft”, “Submit shop for review”, “Connect payments”, and “View live shop”.

## Loading, empty, success, and error states

- [x] Add route-level pending and error states for Seller Hub, onboarding, and shop status.
- [x] Add button-level loading and duplicate-click protection when creating a shop.
- [x] Add upload progress and recoverable upload failures without losing other form data.
- [x] Add explicit save success/failure announcements for assistive technology.
- [x] Add a complete submission success/status handoff with realistic review timing and next actions.

## Testing and observability

- [x] Add component coverage for dirty state, save failure, invalid exit, field semantics, and responsive progress behavior.
- [x] Add server tests for authoritative readiness, terms acceptance, idempotent listing save, and activation publication.
- [x] Add E2E coverage for interruption/resume, back-edit-review, draft deletion, changes requested, approval, 2FA/payment handoff, and public first-listing visibility.
- [x] Track stage completion, save failures, resume rate, submission, moderation outcome, approval-to-activation time, and first-product publication without logging PII.
- [x] Run targeted tests, related tests, accessibility checks, lint, format, TypeScript, and production build.
- [x] Complete desktop, tablet, and narrow-mobile browser inspection and at least one critique/fix pass.

## Completion log

- **2026-07-16:** Completed the five-stage physical-goods journey, authoritative readiness, idempotent first product, 2FA/Mollie launch gate, atomic public product activation, moderation routing and notifications, Seller Hub lifecycle, localization, accessibility, responsive behavior, and post-launch readiness.
- **Verification:** TypeScript, lint, format, production build, bundle budget, migration-chain check, fresh migration, targeted and related Vitest suites (1,330 impacted tests), accessibility suite (143 tests), and 11 focused Chromium E2E tests passed. Desktop, 768 px tablet, and 390 px mobile browser inspections were completed.
- **Performance:** The complete English/Dutch catalog adds localized client code; Paraglide was split into a dedicated `i18n` chunk, reducing the largest initial chunk by approximately 339 KiB. Bundle baselines were remeasured and documented in `config/bundle-budgets.json`.
- **Environment note:** Containerized browser inspection reports imgproxy connection failures when `VITE_IMGPROXY_BASE_URL` points to host `localhost:8080`; host browsers resolve that development URL correctly. Upload, persistence, and public-listing behavior passed in the E2E environment.
