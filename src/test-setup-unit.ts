import { expect } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'

expect.extend(matchers)

process.env.E2E_TEST = 'false'

// Some unit tests reference browser globals (e.g. window.umami, window.location.href via Paraglide).
// Provide a minimal polyfill so they can run in the node environment.
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { href: 'http://localhost:3000' },
  } as unknown as Window & typeof globalThis
}
