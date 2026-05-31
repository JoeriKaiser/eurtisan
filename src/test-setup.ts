import { expect } from 'vitest'
import * as matchers from 'vitest-axe/matchers'
import 'vitest-axe/extend-expect'

expect.extend(matchers)

// JSDOM doesn't implement showModal/close for HTMLDialogElement. Mock them to prevent tests from crashing.
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
