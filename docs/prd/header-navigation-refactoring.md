# PRD: Refactored Production-Ready Header and Navigation

> **Ticket:** `NAV-PROD-002`  
> **Status:** Draft — Ready for Review  
> **Priority:** High  
> **Target Release:** v1.0  
> **Author:** Engineering  
> **Last Updated:** 2026-05-21  

---

## 1. Executive Summary

The header and navigation elements of Eurtisan are the primary touchpoints for user discovery, exploration, and global control. Currently, the implementation suffers from significant usability, layout, and styling limitations on mobile devices (e.g., hidden navigation links, missing search access, and a floating locale switcher). On desktop, the header lacks the visual polish, interactive micro-animations, and smooth transition states expected of a premium, production-grade European custom merchandise marketplace.

This PRD defines the requirements to refactor and elevate the Eurtisan header, navigation drawer, categories dropdown, search triggers, and locale switcher into a unified, highly polished, fully responsive, and accessible navigation system.

---

## 2. Current State Analysis

### 2.1 What Exists Today

| File / Component | Status | Notes |
|------------------|--------|-------|
| `Header.tsx` | ⚠️ Basic | Core desktop header; hides navigation links and search trigger completely on mobile screen sizes. |
| `UserMenu.tsx` | ✅ Functional | Account dropdown for signed-in users. Handles navigation to account, settings, and sign-out. |
| `ThemeToggle.tsx` | ✅ Functional | Interactive button toggling the dark/light mode class on the document root. |
| `LocaleSwitcher.tsx` | ⚠️ Floating | Rendered at `fixed bottom-4 right-4` across the entire app via the root layout. |
| `__root.tsx` | ✅ Active | Root route layout rendering the header and the floating switcher globally. |

### 2.2 Quality Gaps (Relative to Premium UX/UI Standard)

| Gap | Severity | Reference Standard |
|-----|----------|-------------------|
| **No Mobile Navigation Menu** — Navigation links ("Home", "About", "Categories") are hidden on mobile/tablet screens with no hamburger toggle or mobile drawer. | 🔴 High | Core responsive navigation standard |
| **No Mobile Search Trigger** — The search bar is completely hidden on mobile/tablet viewports, leaving touch users unable to search. | 🔴 High | Core marketplace functionality |
| **Floating Locale Switcher** — A floating badge at the bottom-right corner looks unfinished and obstructs user content. | 🔴 High | Clean and cohesive footer/header design |
| **Lack of Zero CLS in Categories** — Async loading of categories (`useEffect`) causes the dropdown trigger to pop in/out and shift layouts. | 🟡 Medium | Zero CLS constraint |
| **Simplistic Categories Dropdown** | 🟡 Medium | Dropdown animation/hover polish |
| **Text-only Branding** — The logo is a simple text element with no visual icon or gradient flair. | 🟡 Medium | Brand identity and visual premium feel |
| **Incomplete ARIA / Keyboard accessibility** — Missing focus visible indicators, explicit `aria-expanded` attributes, and localized announcements. | 🟡 Medium | Web accessibility (a11y) standards |

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. **Mobile Hamburger & Slide-out Drawer** — Implement a fully accessible mobile navigation drawer (`AdminMobileDrawer` style) to display core links, search triggers, and locale selectors.
2. **Integrated Locale Selector** — Relocate the language switcher from the floating corner into the header on desktop (as a clean dropdown) and inside the navigation drawer on mobile.
3. **Mobile Search Entrypoint** — Add a dedicated search icon button for smaller viewports that triggers the existing search overlay.
4. **Aesthetic Enhancements & Brand Identity** — Redesign the Eurtisan logo link with a custom gradient and premium micro-animations (e.g., subtle hover shifts). Add smooth transitions to dropdown triggers and active links.
5. **Zero CLS & Loading Skeletons** — Ensure the header navigation bar retains a fixed height and provides beautiful skeletal inline loaders while category lists fetch in the background.
6. **Focus Ring & ARIA Compliance** — Add highly visible keyboard focus rings, proper `aria-controls`, `aria-expanded`, and screen reader labels.

### 3.2 Non-Goals

- **Search Algorithm Refactoring** — This PRD focuses purely on the header/navigation layout and trigger mechanisms, not search execution or backend querying.
- **Dynamic Category Tree CRUD in Header** — Listing categories is read-only; administrative changes are handled in the Admin Panel.

---

## 4. Detailed Feature Specifications

### 4.1 Header Shell (`Header.tsx` & Layout)

**File:** `src/components/Header.tsx` [MODIFY]

**Visual Design & Polish:**
- Keep the `sticky top-0 z-sticky` positioning with a premium `backdrop-blur-lg bg-surface-default/80 border-b border-border-default` background styling.
- Maintain a consistent height (`64px`) across all devices to prevent CLS.
- **Logo Refactoring:** Update the text logo. Wrap in an inline logo package containing a stylized geometric icon and text using a subtle custom gradient (e.g., `bg-gradient-to-r from-accent-primary to-accent-secondary bg-clip-text text-transparent`).

---

### 4.2 Mobile Hamburger & Drawer (`MobileNavDrawer.tsx`)

**File:** `src/components/MobileNavDrawer.tsx` [NEW]

**Interactive Rules:**
- Renders a hamburger icon button (`menu` from lucide-react) on viewports `< md`.
- Clicking the hamburger slides a full-height navigation drawer from the left side of the screen.
- **Drawer Contents:**
  - Close button at the top right.
  - Linear stack of navigation links: *Home*, *About*, and *Categories* (collapsible list).
  - Language toggle selector (integrated Locale Switcher).
  - Theme Toggle icon button.
- **Accessibility:**
  - Focus is trapped inside the drawer when open.
  - Pressing `Escape` or clicking the backdrop overlay closes the drawer.
  - Close/Open buttons use descriptive `aria-label` tags.

---

### 4.3 Mobile Search Trigger

**File:** `src/components/Header.tsx` [MODIFY]

**Adaptive Search Rules:**
- **Desktop (>= md):** Keeps the inline search bar with keyboard shortcut prompt `/`.
- **Mobile (< md):** Renders a clean search icon button (`Search` from lucide-react) next to the cart icon. Clicking this button triggers the global `SearchOverlay`.

---

### 4.4 Categories Dropdown & Loading State

**File:** `src/components/Header.tsx` [MODIFY]

**Interactive Refinement:**
- Introduce a smooth slide-up and fade-in transition (`transition-all duration-fast`) for the categories dropdown.
- **CLS Prevention:** While categories are loading, display an inline skeleton placeholder of matching dimensions instead of hiding/showing the "Categories" button.

---

### 4.5 Integrated Locale Dropdown

**File:** `src/components/LocaleDropdown.tsx` [NEW]

**Layout Refinement:**
- Replace the floating fixed Locale Switcher.
- Renders an elegant language selector dropdown next to the user menu and theme toggle on desktop.
- Displays the current language code (e.g., "EN", "FR") alongside a globe or chevron icon.
- Clicking lists all available languages with active state checks.

---

## 5. Design & Accessibility Standards

### 5.1 Design Tokens
- Use standard HSL variables:
  - Text: `text-text-primary`, `text-text-secondary`, `text-text-muted`
  - Hover states: `hover:bg-bg-inset`, `hover:text-text-primary`
  - Active states: Underlined or highlighted with `text-accent-primary`
- Avoid raw colors or hardcoded hex codes.

### 5.2 Accessibility Specs
- Hamburger button must have `aria-haspopup="dialog"` and `aria-expanded` tracking open states.
- The mobile nav drawer must render inside a React Portal (e.g., `DialogPortal` or custom portal) and manage focus loops using standard accessibility practices.
- Notification and cart count badges must have screen-reader descriptions (e.g., `aria-label="3 items in cart"`).

---

## 6. Technical & Routing Architecture

### 6.1 Directory & Component Structure

```
src/
  components/
    Header.tsx              # Modified to integrate mobile triggers & skeleton loader
    MobileNavDrawer.tsx     # [NEW] Slide-out drawer with focus trapping
    LocaleDropdown.tsx      # [NEW] Header-integrated locale selector dropdown
    LocaleSwitcher.tsx      # [REMOVED]
  routes/
    __root.tsx              # Cleaned up (remove absolute LocaleSwitcher import/render)
```

---

## 7. Verification Plan

### 7.1 Automated Testing

#### Component Tests (`Header.test.tsx` & `MobileNavDrawer.test.tsx`)
- Verify the mobile hamburger button is only visible on mobile screen sizes.
- Verify clicking the hamburger button opens the drawer and traps keyboard focus.
- Verify clicking the backdrop or pressing `Escape` closes the drawer.
- Verify cart and notification badges display correct dynamic numbers and screen-reader labels.

### 7.2 Manual Verification
- Test viewport responsiveness from `320px` to `1440px`.
- Verify the header looks perfect in both dark and light modes.
- Audit keyboard-only navigation (Tab keys and Enter keys) to open/close/nav the header, mobile drawer, and dropdowns.
- Confirm zero CLS during layout rendering and categories fetching.

---

*End of PRD*
