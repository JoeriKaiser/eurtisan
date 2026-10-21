import type { AxeMatchers } from 'vitest-axe'

declare module 'vitest' {
  interface Assertion<R = void, T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
