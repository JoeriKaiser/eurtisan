# Theme script hydration

The inline script in `RootDocument` runs **before** React hydrates to apply `light`/`dark` from `localStorage` or `prefers-color-scheme`. This avoids a flash of the wrong theme.

**Rules:**
- The server must **not** emit `class="dark"` or `class="light"` on `<html>` — only the client script sets theme classes.
- `suppressHydrationWarning` on `<html>` is required because the script mutates the DOM before hydration.
- After hydration, theme changes go through the same `localStorage` key (`theme`).

Do not remove the script without replacing it with an equivalent SSR-safe approach.
