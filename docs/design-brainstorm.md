# Design Brainstorm — Global Theme & Design System

> Saved conversation between agent and developer, May 2026.
> Context: Eurtisan is a European-centered marketplace for creatives, artisans, and makers.

## Current State

- **Framework**: TanStack Start (SSR, file-based routing)
- **Styling**: Tailwind CSS v4 with `@theme` blocks
- **Fonts**: Fraunces (display/hero) + Manrope (UI/body) — already a strong editorial pairing
- **Current palette**: Warm green/teal (`sand`, `foam`, `palm`, `lagoon`, `sea-ink`) — on-brand for artisan/maker theme
- **Dark mode**: `data-theme` + class strategy, system preference fallback
- **Components**: Hand-rolled (`Header`, `Footer`, `UserMenu`, `ThemeToggle`, `SearchSidebar`)
- **Auth**: Better Auth with role-based access (customer, creator, admin)
- **i18n**: Paraglide (localization-ready)
- **Icons**: Lucide React

## Strengths

- Font pairing (Fraunces + Manrope) already feels artisan/editorial
- Custom properties enable theme switching
- Some nice patterns exist (`island-shell`, `feature-card`, `nav-link`, `rise-in`)
- Dark mode infrastructure is solid

## Gaps Identified

1. **Token naming is poetic but not scalable** (`sea-ink`, `lagoon`) — hard to extend systematically
2. **Accessibility gaps in hand-rolled components** — UserMenu lacks focus trapping, Escape-to-close, arrow-key nav, roving tabindex
3. **Inconsistent styling** — UserMenu hardcodes `neutral-100` / `dark:bg-neutral-800` instead of using custom tokens
4. **No primitive component layer** — every interactive pattern reinvented from scratch
5. **Visual noise** — body background has 4-layer gradient + 2 pseudo-element overlays; cards have multi-layer shadows + inset glints
6. **No semantic token layer** — colors are surface-specific, not role-based

## Proposed Direction

### Adopt Base UI

Install `@base-ui-components/react` for unstyled, accessible primitives:
- `Dialog` — confirmations, modals
- `DropdownMenu` — UserMenu replacement
- `Popover` — tooltips, quick previews
- `Select` — forms, filters
- `Tabs` — product detail, studio dashboard
- `Checkbox` / `Switch` / `Radio` — settings, forms
- `Accordion` — FAQ, category filters
- `Slider` — price range filters
- `Tooltip` — icon explanations

**Why Base UI**: unstyled (no style fighting with Tailwind), full a11y out of the box, composable API, React 19 compatible.

### Color Strategy: Warm Artisan

Per impeccable design laws — physical scene:
> A maker in their Lisbon atelier, late morning light through linen curtains, wooden workbench, dried herbs hanging from exposed beams, ceramic glazes drying on a rack. The interface should feel like handmade paper and mossy stone — warm, grounding, trustworthy.

**Strategy**: Restrained with moments of Committed on hero/landing surfaces.

**Palette (OKLCH, no purple/orange)**:

| Role | Light | Dark | Character |
|------|-------|------|-----------|
| Primary | `oklch(52% 0.09 145)` Moss | `oklch(65% 0.08 145)` Soft Moss | Nature, growth, trust |
| Accent | `oklch(58% 0.1 175)` Warm Sage | `oklch(72% 0.09 175)` Pale Sage | Fresh, European, calm |
| Text primary | `oklch(28% 0.02 75)` Walnut | `oklch(92% 0.01 80)` Warm Linen | Warm, not harsh black |
| Text secondary | `oklch(50% 0.03 80)` Warm Grey | `oklch(70% 0.02 80)` Muted Linen | |
| Surface base | `oklch(97% 0.01 85)` Cream | `oklch(18% 0.02 75)` Deep Charcoal | |
| Surface elevated | `oklch(98% 0.012 85)` Parchment | `oklch(22% 0.02 75)` Charcoal Lift | |
| Border | `oklch(85% 0.02 85)` Sand Line | `oklch(32% 0.03 80)` Muted Border | |
| Success | `oklch(55% 0.1 145)` Moss | same | |
| Error | `oklch(55% 0.16 25)` Brick | `oklch(65% 0.14 25)` Terracotta | Warm red, not cold |
| Warning | `oklch(70% 0.12 95)` Ochre Clay | `oklch(75% 0.1 95)` Muted Gold | Earthy yellow, not orange |

### Token Architecture (3-Layer)

```css
/* Layer 1: Raw palette */
--palette-walnut-50 ... 950
--palette-moss-50 ... 950
--palette-sage-50 ... 950

/* Layer 2: Semantic tokens */
--color-text-primary
--color-text-secondary
--color-bg-base
--color-bg-elevated
--color-accent-primary
--color-border-default
--color-surface-default
--color-shadow

/* Layer 3: Component tokens */
--button-primary-bg
--card-border-radius
--input-focus-ring
```

### Typography

- **Keep Fraunces + Manrope** — already editorial and artisan-feeling
- Display/hero: Fraunces 500–700, optical size
- UI/body: Manrope 400–800
- Data/prices: `font-variant-numeric: tabular-nums`
- Scale ratio: 1.25 (marketing), 1.125 (dense UI)
- Measure: cap body at `65ch`

### Component System Structure

```
src/components/ui/
├── primitives/          # Base UI wrappers
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── popover.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   ├── tooltip.tsx
│   └── checkbox.tsx
├── button.tsx
├── input.tsx
├── textarea.tsx
├── card.tsx
├── badge.tsx
├── skeleton.tsx
├── separator.tsx
└── index.ts
```

### Layout Changes

1. **Simplify body background** — warm base + one subtle radial glow
2. **Reduce card decoration** — one warm shadow + subtle border
3. **Header** — keep sticky + backdrop blur, use semantic surface tokens
4. **Page rhythm** — consistent section spacing tokens (`--space-section`)

### Migration Path

| Phase | Work |
|-------|------|
| 1 | Restructure `styles.css` with 3-layer tokens |
| 2 | Install Base UI + build primitive wrappers |
| 3 | Build styled component library |
| 4 | Refactor existing components |
| 5 | Remove old custom properties |

## Dependencies to Add

- `@base-ui-components/react` — accessible unstyled primitives

## Status

✅ **IMPLEMENTED** — May 2026

All decisions resolved:
- OKLCH values finalized in `src/styles.css`
- `island-shell` simplified: one shadow layer + subtle border
- Hero uses restrained radial glows (OKLCH moss/sage at low opacity)
- Motion: responsive level (state transitions only, 150-300ms ease-out-quart)
- Full Base UI primitive layer installed and wrapped
- All existing components migrated to new tokens
- TypeScript, lint, and build all pass cleanly
