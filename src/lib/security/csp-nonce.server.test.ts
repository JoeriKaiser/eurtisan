import { describe, expect, it } from 'vitest'
import { injectScriptNonces } from './csp-nonce.server'

describe('injectScriptNonces', () => {
  it('adds the nonce attribute to inline scripts without one', () => {
    const result = injectScriptNonces('<script>a()</script>', 'fresh-nonce')
    expect(result).toBe('<script nonce="fresh-nonce">a()</script>')
  })

  it('normalizes existing script nonces to the final response nonce', () => {
    const html = '<script nonce="cached-nonce">one</script><script type="module">two</script>'
    const result = injectScriptNonces(html, 'response-nonce')

    expect(result).not.toContain('cached-nonce')
    expect(result.match(/nonce="response-nonce"/g)).toHaveLength(2)
  })
})
