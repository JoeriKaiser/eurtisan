import { expect } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'

expect.extend(matchers)

// axe-core asks canvas for color calculations. JSDOM intentionally omits the
// implementation, so provide the platform's valid "context unavailable" result.
if (typeof HTMLCanvasElement === 'function') {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  })
}

// JSDOM doesn't implement showModal/close for HTMLDialogElement.
// Mock them to prevent component tests from crashing.
if (typeof HTMLDialogElement === 'function') {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    const event = new Event('close', { bubbles: true })
    this.dispatchEvent(event)
  }
}
