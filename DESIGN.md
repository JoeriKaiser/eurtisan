---
name: Eurtisan
description: A European-centered marketplace for creatives, artisans, and makers.
colors:
  moss-500: "#3d8b6e"
  moss-400: "#4fa883"
  sage-500: "#4a9e8f"
  sage-400: "#5db8a8"
  walnut-900: "#1e1a16"
  walnut-800: "#2d2823"
  walnut-500: "#6b6054"
  walnut-400: "#8a7d6e"
  walnut-100: "#f5f2ee"
  walnut-50: "#faf8f5"
  brick-500: "#a8443a"
  brick-400: "#c25a4f"
  ochre-500: "#c49a4a"
  ochre-400: "#d4b06a"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.5rem, 6vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0"
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  7: "28px"
  8: "32px"
  9: "36px"
  10: "40px"
  11: "44px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.moss-500}"
    textColor: "{colors.walnut-50}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.moss-600}"
    textColor: "{colors.walnut-50}"
  button-secondary:
    backgroundColor: "{colors.walnut-50}"
    textColor: "{colors.walnut-900}"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.walnut-50}"
    textColor: "{colors.walnut-900}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.walnut-50}"
    rounded: "{rounded.xl}"
    padding: "20px"
  card-elevated:
    backgroundColor: "{colors.walnut-50}"
    rounded: "{rounded.xl}"
    padding: "20px"
  badge-primary:
    backgroundColor: "{colors.moss-100}"
    textColor: "{colors.moss-500}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Eurtisan

## 1. Overview

**Creative North Star: "The Lisbon Atelier"**

Eurtisan's visual system evokes a maker's workshop in late-morning light: warm stone, handmade paper, mossy ceramic glazes, and linen curtains. The interface feels grounded, tactile, and European — never sterile, never loud. Every surface celebrates the artisan's craft rather than the platform itself.

The system serves a dual-register marketplace: brand surfaces (landing, discovery) lean into committed warmth and editorial typography, while product surfaces (dashboards, forms, shop management) stay restrained and task-focused. Both share the same warm DNA.

**Key Characteristics:**
- Warm OKLCH palette with moss green primary and sage teal accent
- Fraunces display + Manrope body type pairing
- 4pt spacing scale with semantic token names
- Restrained elevation: subtle shadows, tonal layering in dark mode
- Full Base UI primitive layer for accessibility
- WCAG 2.1 AA compliance throughout

## 2. Colors

The palette is built in OKLCH for perceptual uniformity. Every neutral is tinted toward the warm walnut hue (75°) for subconscious cohesion.

### Primary
- **Moss Green** (`oklch(52% 0.09 145)`): Primary actions, active states, focus indicators. The color of growth and trust.
- **Moss Light** (`oklch(62% 0.09 145)`): Dark mode primary, hover states.

### Secondary
- **Warm Sage** (`oklch(58% 0.1 175)`): Brand lockup, links, secondary accents, and focus rings. Fresh and European.
- **Sage Light** (`oklch(72% 0.09 175)`): Dark mode brand lockup, links, and subtle accents.

### Neutral
- **Walnut 900** (`oklch(18% 0.014 75)`): Light mode text primary. Warm, not black.
- **Walnut 500** (`oklch(52% 0.022 75)`): Light mode text secondary.
- **Walnut 100** (`oklch(93% 0.008 75)`): Light mode surface inset, borders.
- **Walnut 50** (`oklch(97% 0.005 75)`): Light mode background base.
- **Walnut 950** (`oklch(10% 0.012 75)`): Dark mode background base. Never pure black.
- **Walnut 800** (`oklch(26% 0.016 75)`): Dark mode surface elevated.

### Semantic
- **Brick** (`oklch(55% 0.16 25)`): Errors, destructive actions. Warm red, never cold.
- **Ochre Clay** (`oklch(70% 0.12 95)`): Warnings. Earthy yellow, not orange.

### Named Rules
**The 10% Rule.** The primary accent (moss green) appears on ≤10% of any product UI screen. Its rarity is the point. Brand surfaces may exceed this in hero moments.

**The Unified Lockup Rule.** The Eurtisan mark and wordmark use the same semantic brand token: warm sage in light mode and sage light in dark mode. Never colour the two parts independently.

**The No-Purple-No-Orange Rule.** These hues are explicitly excluded from the palette. They are not used anywhere in the system.

## 3. Typography

**Display Font:** Fraunces, Georgia, serif (variable, optical sizing enabled)
**Body Font:** Manrope, system-ui, sans-serif (weights 400–800)

**Character:** An editorial serif for display creates warmth and craft credibility. Manrope's geometric humanist forms feel contemporary European without being cold.

### Hierarchy
- **Display** (700, clamp(2.5rem, 6vw, 4rem), 1.05, -0.02em): Hero headlines, landing page titles. Max line length 60ch.
- **Headline** (700, 2rem, 1.1, -0.01em): Section headings, page titles.
- **Title** (600, 1.25rem, 1.3): Card titles, subheadings.
- **Body** (400, 1rem, 1.6): Body text, descriptions. Max line length 65ch.
- **Label** (500, 0.875rem, 1.4, 0.01em): Buttons, inputs, navigation. Uppercase only for kickers with 0.12em tracking.

### Named Rules
**The One Family Rule.** Product UI surfaces (dashboards, forms, tables) use Manrope exclusively. Fraunces is reserved for brand surfaces and display moments.

## 4. Elevation

The system uses **subtle shadows for light mode** and **tonal layering for dark mode**. Surfaces are flat at rest; elevation appears as a response to state (hover, focus, scroll) or hierarchy (modals, dropdowns).

### Shadow Vocabulary
- **Sm** (`0 1px 2px oklch(20% 0.02 75 / 0.05)`): Subtle borders, chips, inline elements.
- **Md** (`0 4px 12px oklch(20% 0.02 75 / 0.07)`): Cards at hover, dropdowns.
- **Lg** (`0 8px 24px oklch(20% 0.02 75 / 0.09)`): Modals, elevated panels.
- **Xl** (`0 16px 48px oklch(20% 0.02 75 / 0.11)`): Full-screen overlays, toasts.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state or elevation level. Dark mode conveys depth through surface lightness, not shadow.

## 5. Components

### Buttons
- **Shape:** 12px radius, medium height (40px), inline-flex with gap.
- **Primary:** Moss green background, walnut-50 text, shadow-sm. Hover: moss-600, shadow-md.
- **Secondary:** Surface-default background, text-primary, border-default. Hover: bg-inset.
- **Ghost:** Transparent background, text-secondary. Hover: bg-inset, text-primary.
- **Danger:** Brick background, white text. Hover: brick-hover.
- **Loading state:** Spinner icon replaces content, disabled interaction.

### Inputs
- **Shape:** 12px radius, 40px height, border-default background.
- **Focus:** Border shifts to accent-secondary, 2px ring at 20% opacity.
- **Error:** Brick border, brick ring at 20% opacity.
- **Placeholder:** text-muted color (must meet 4.5:1 contrast).

### Cards
- **Default:** Surface-default, border-default, shadow-sm, 16px radius.
- **Elevated:** Surface-elevated, border-default, shadow-md.
- **Inset:** Surface-inset, border-subtle, no shadow.
- **Hover:** translateY(-2px), shadow-md, border-strong.

### Badges
- **Shape:** Full radius (pill), xs text, uppercase optional.
- **Variants:** default, primary, secondary, outline, error, success, warning.
- **Each:** Subtle background tint + matching border at 20% opacity.

### Navigation
- **Header:** Sticky, backdrop-blur-lg, surface-default/80, border-bottom.
- **Nav links:** text-secondary at rest, text-primary on hover/active. 2px moss underline slides in from left.
- **Mobile:** Hamburger pattern (to be implemented per surface).

### Dropdown Menu
- Built on Base UI Menu primitive for full keyboard/accessibility.
- **Popup:** 224px width, 16px radius, shadow-lg, surface-default.
- **Item:** 8px radius, text-primary, hover:bg-inset.
- **Separator:** 1px border-default.
- **Group label:** text-muted, xs size.

### Dialog
- Built on Base UI Dialog primitive.
- **Backdrop:** bg-overlay with backdrop-blur-sm.
- **Popup:** Centered, max-w-lg, 16px radius, shadow-xl.
- **Entrance:** Scale from 95% + fade.

## 6. Do's and Don'ts

### Do:
- **Do** use the 3-layer token architecture (primitive → semantic → component).
- **Do** keep Fraunces for display and Manrope for UI. One family per surface type.
- **Do** use `focus-visible` with 2px offset rings in sage for all interactive elements.
- **Do** provide skeleton states for content loading, not spinners in the middle of content.
- **Do** handle `prefers-reduced-motion` with instant state transitions.
- **Do** use semantic token names (`text-primary`, `bg-base`) instead of raw palette names in components.
- **Do** cap body text at 65ch for readability.
- **Do** use tabular-nums for prices and quantities.

### Don't:
- **Don't** use purple or orange anywhere in the palette.
- **Don't** use generic bootstrap marketplace card grids with icon + heading + text, repeated endlessly.
- **Don't** use SaaS-cream minimalism (sterile white/gray/blue defaults).
- **Don't** use dark-mode-terminal aesthetics (cold, technical dark themes).
- **Don't** rely on color alone for state or meaning — always pair with icons, text, or shape.
- **Don't** use `outline: none` without a `focus-visible` replacement.
- **Don't** nest cards inside cards. Use spacing and dividers instead.
- **Don't** use gradient text (`background-clip: text`). Use a single solid color.
- **Don't** use glassmorphism as a default treatment.
- **Don't** use side-stripe borders greater than 1px as colored accents.
