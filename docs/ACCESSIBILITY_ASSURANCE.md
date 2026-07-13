# Marketplace accessibility assurance

## Release standard and regression gate

WCAG 2.1 AA is the release floor. Automated checks are regression signals, not a conformance claim. `make test-accessibility` runs focused Vitest component/runtime scans and static contrast, reflow, reduced-motion, forced-colors, and skip-navigation contracts. CI runs this target in the existing quality job before the complete `make test` gate. No Playwright scenario is added or broadened by this assurance layer.

Automated scans use the installed `vitest-axe` 0.1.0 / axe-core integration and Testing Library against rendered DOM. They test behavior and semantics, not snapshots. Color contrast is checked with repository-local OKLCH-to-relative-luminance calculations for the semantic light/dark token pairs because JSDOM cannot evaluate rendered CSS contrast reliably.

Current exceptions: **none**. A future exception is invalid unless it names the exact component, WCAG impact and reason, accountable owner, expiry date, and follow-up manual/automated validation. Serious or critical axe findings cannot be excepted merely to pass CI.

## Critical-flow matrix

`automated` means representative component states and shared primitives are gated locally. It does not mean the complete journey has been manually certified.

| Critical flow | Automated repository coverage | Keyboard and screen-reader evidence | Owner action before launch |
|---|---|---|---|
| Sign-up, sign-in, 2FA | Sign-in, sign-up validation, and 2FA rendered-state axe scans; names, errors, status announcements, and focus styling | `not-run` | Accessibility owner runs authentication checklist with NVDA or VoiceOver. |
| Search and product detail | Product detail purchasable-state scan; gallery/quantity keyboard tests; search labels and live results tests | `not-run` | Verify result-count announcement, filters, gallery order, and localized search. |
| Cart and checkout | Cart populated/empty axe scans; initial checkout scan; validation/error focus tests | `not-run` | Complete cart, address, shipping, service-point dialog, payment redirect, and failure recovery. |
| Account settings | Existing settings component behavior; shared form/error/status gate | `not-run` | Verify profile and security forms, password management, 2FA, deletion dialog, and saved status. |
| Orders and disputes | Dispute page/loading/error scans; order and status component tests | `not-run` | Verify order list/detail, tracking, dispute creation/thread, attachment-free messaging, and refund status. |
| Creator onboarding | Existing step validation and keyboard behavior tests; shared form and upload gate | `not-run` | Complete all steps at narrow width and 400% zoom; verify progress and error summary announcements. |
| Product editing | Upload/error/status scan; product editor interaction tests; dialog primitive gate | `not-run` | Verify image ordering/removal, required fields, save state, delete/cancel dialogs, and text expansion. |
| Fulfillment | Existing fulfillment dialog/component tests; shared dialog/form/status gate | `not-run` | Verify keyboard-only shipping method, tracking, label errors, and focus restoration. |
| Admin moderation | Sortable table, row selection, pagination, menu, and dialog scans/keyboard tests | `not-run` | Verify moderation tables, filters, application review, suspension/ban, disputes, and audit log. |

## Automated coverage contract

Focused tests cover:

- reusable inputs, selects, textareas, buttons, banners, badges, dialogs, and menus;
- accessible names/descriptions, `required`, `aria-invalid`, `aria-errormessage`, and live regions;
- native sortable-table buttons, `aria-sort`, selection controls, named pagination, and page announcements;
- upload input naming, error association, keyboard-operable trigger, progress count, upload status, and icon-only controls;
- dialog focus placement, Escape dismissal, and trigger-focus restoration;
- menu keyboard opening, item focus, Escape dismissal, and trigger-focus restoration;
- representative authentication, product detail, cart, checkout, dispute, loading, empty, success, and error states;
- localized English/Dutch labels used by scanned controls and static key parity through i18n compilation;
- light/dark semantic-token contrast at 4.5:1 for normal text and 3:1 for focus/UI indicators;
- zoom-enabled viewport configuration, narrow-layout wrapping/overflow assumptions, reduced motion, forced-colors focus, and skip navigation.

At 200% and 400% zoom, the repository contract avoids disabling zoom, permits text wrapping, and uses responsive/overflow containers for dense tables. Real browser reflow remains part of the manual checklist because JSDOM has no reliable layout engine.

## Manual NVDA or VoiceOver evidence checklist

Status for every item below: **`not-run`**. Owner: accessibility owner with the relevant customer/creator/admin product owner. Blocker: an authorized production-image staging deployment, supported browser, and assistive-technology operator are required. Do not turn repository-local axe output into fabricated screen-reader evidence.

Record the release Git SHA/image digest, OS, browser/version, assistive technology/version, locale, theme, viewport/zoom, operator, observed time, outcome, safe issue references, and no PII/cookies/tokens. Store evidence in the controlled qualification store, not Git.

For each matrix flow:

1. Start at the skip link. Confirm focus is visible, the localized name is announced, activation moves focus to page content, and headings/landmarks provide a coherent outline.
2. Complete the flow with keyboard only. Confirm logical order, no trap, native Space/Enter/Escape/arrow behavior, and focus restoration after dialogs/menus.
3. With NVDA + Firefox/Chrome on Windows **or** VoiceOver + Safari on macOS/iOS, confirm control names, roles, values, descriptions, required/invalid state, errors, status badges, table headers/sort state, pagination, upload state, and async completion.
4. Trigger validation, loading, empty, success, provider delay, and failure states. Confirm each meaningful change is announced once without stealing focus unexpectedly.
5. Test light and dark themes, Windows High Contrast/forced colors where available, and `prefers-reduced-motion: reduce`.
6. Test a narrow 320 CSS-pixel viewport, 200% zoom, and 400% zoom. Confirm no two-dimensional scrolling for ordinary content, no clipped controls/messages, and table overflow remains usable.
7. Switch between English and Dutch. Confirm names/associations remain intact, expanded text wraps, and no control relies on an untranslated icon or placeholder.
8. For checkout, disputes, payouts, moderation, and destructive actions, verify confirmation language and recovery behavior with the responsible domain owner.

## Evidence completion

The staging qualification checks `quality.accessibility` and `approval.accessibility` remain `not-run` until the manual record above is completed and reviewed. A failed or blocked item remains explicit; it must not be converted to passed through an allowlist, axe rule disable, or undocumented exception.
