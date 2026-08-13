import type { AxeMatchers } from 'vitest-axe'

declare module '@vitest/expect' {
  // biome-ignore lint/suspicious/noExplicitAny: matches external library signature
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
