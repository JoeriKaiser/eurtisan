import { describe, expect, it } from 'vitest'
import {
  hasDangerousContent,
  hasHtmlTags,
  sanitizeRichText,
  validatePlainText,
  validateTrackingUrl,
} from './xss'

describe('hasHtmlTags', () => {
  it('returns true for HTML tags', () => {
    expect(hasHtmlTags('<div>')).toBe(true)
    expect(hasHtmlTags('</div>')).toBe(true)
    expect(hasHtmlTags('<br/>')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(hasHtmlTags('Hello world')).toBe(false)
    expect(hasHtmlTags('3 < 4 and 5 > 2')).toBe(false)
  })
})

describe('hasDangerousContent', () => {
  it('detects script tags', () => {
    expect(hasDangerousContent('<script>alert(1)</script>')).toBe(true)
    expect(hasDangerousContent('<SCRIPT>alert(1)</SCRIPT>')).toBe(true)
  })

  it('detects javascript: protocol', () => {
    expect(hasDangerousContent('javascript:alert(1)')).toBe(true)
    expect(hasDangerousContent('JAVASCRIPT:alert(1)')).toBe(true)
  })

  it('detects event handlers inside tags', () => {
    expect(hasDangerousContent('<img onclick="alert(1)">')).toBe(true)
    expect(hasDangerousContent('<p onerror="alert(1)">')).toBe(true)
  })

  it('returns false for safe text', () => {
    expect(hasDangerousContent('Hello world')).toBe(false)
    expect(hasDangerousContent('Monday morning')).toBe(false)
    expect(hasDangerousContent('I once went there')).toBe(false)
    expect(hasDangerousContent('onclick=alert(1)')).toBe(false)
  })
})

describe('sanitizeRichText', () => {
  it('returns null for empty input', () => {
    expect(sanitizeRichText('')).toBeNull()
    expect(sanitizeRichText(null)).toBeNull()
    expect(sanitizeRichText(undefined)).toBeNull()
    expect(sanitizeRichText('   ')).toBeNull()
  })

  it('allows allowed tags', () => {
    expect(sanitizeRichText('<p>Hello</p>')).toBe('<p>Hello</p>')
    expect(sanitizeRichText('<strong>Bold</strong>')).toBe('<strong>Bold</strong>')
    expect(sanitizeRichText('<em>Italic</em>')).toBe('<em>Italic</em>')
    expect(sanitizeRichText('<br>')).toBe('<br>')
    expect(sanitizeRichText('<br/>')).toBe('<br>')
  })

  it('removes non-allowed tags', () => {
    expect(sanitizeRichText('<div>Hello</div>')).toBe('Hello')
    expect(sanitizeRichText('<span>Hello</span>')).toBe('Hello')
  })

  it('removes attributes from allowed tags', () => {
    expect(sanitizeRichText('<p class="x">Hello</p>')).toBe('<p>Hello</p>')
    expect(sanitizeRichText('<strong style="color:red">Bold</strong>')).toBe(
      '<strong>Bold</strong>',
    )
  })

  it('strips script tags and their contents', () => {
    expect(sanitizeRichText('<script>alert(1)</script>')).toBeNull()
    expect(sanitizeRichText('Hello <script>alert(1)</script> world')).toBe('Hello  world')
  })

  it('strips javascript: protocol', () => {
    expect(sanitizeRichText('javascript:alert(1)')).toBe('alert(1)')
  })

  it('strips event handlers via attribute removal', () => {
    expect(sanitizeRichText('<p onclick="alert(1)">Hello</p>')).toBe('<p>Hello</p>')
  })

  it('handles nested disallowed tags', () => {
    expect(sanitizeRichText('<div><p>Hello</p></div>')).toBe('<p>Hello</p>')
  })

  it('handles mixed allowed and disallowed tags', () => {
    expect(sanitizeRichText('<div><p><strong>Hi</strong></p></div>')).toBe(
      '<p><strong>Hi</strong></p>',
    )
  })

  it('neutralizes XSS payloads', () => {
    expect(sanitizeRichText('<img src=x onerror=alert(1)>')).toBeNull()
    expect(sanitizeRichText('<svg onload=alert(1)>')).toBeNull()
  })
})

describe('validatePlainText', () => {
  it('returns trimmed text for valid input', () => {
    expect(validatePlainText('  Hello  ')).toBe('Hello')
  })

  it('throws 400 for HTML tags', () => {
    expect(() => validatePlainText('<div>Hello</div>', 'Name')).toThrow()
    try {
      validatePlainText('<div>Hello</div>', 'Name')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for script tags', () => {
    expect(() => validatePlainText('Hello <script>alert(1)</script>', 'Title')).toThrow()
  })

  it('throws 400 for javascript: protocol', () => {
    expect(() => validatePlainText('javascript:alert(1)', 'Url')).toThrow()
  })

  it('throws 400 for event handlers inside tags', () => {
    expect(() => validatePlainText('<p onclick="alert(1)">Hello</p>', 'Body')).toThrow()
  })

  it('does not throw for safe text containing < or >', () => {
    expect(validatePlainText('3 < 4 and 5 > 2')).toBe('3 < 4 and 5 > 2')
  })

  it('does not throw for words starting with "on"', () => {
    expect(validatePlainText('Monday morning')).toBe('Monday morning')
    expect(validatePlainText('once upon a time')).toBe('once upon a time')
  })
})

describe('validateTrackingUrl', () => {
  it('returns null for empty/null/undefined input', () => {
    expect(validateTrackingUrl('')).toBeNull()
    expect(validateTrackingUrl(null)).toBeNull()
    expect(validateTrackingUrl(undefined)).toBeNull()
  })

  it('returns trimmed URL for valid HTTP(S) URLs', () => {
    expect(validateTrackingUrl('https://track.example.com/123')).toBe(
      'https://track.example.com/123',
    )
    expect(validateTrackingUrl('http://track.example.com/123')).toBe('http://track.example.com/123')
    expect(validateTrackingUrl('  https://track.example.com/123  ')).toBe(
      'https://track.example.com/123',
    )
  })

  it('throws 400 for javascript: scheme', () => {
    expect(() => validateTrackingUrl('javascript:alert(1)')).toThrow()
    try {
      validateTrackingUrl('javascript:alert(1)')
    } catch (err) {
      expect(err).toBeInstanceOf(Response)
      expect((err as Response).status).toBe(400)
    }
  })

  it('throws 400 for data: scheme', () => {
    expect(() => validateTrackingUrl('data:text/html,<script>alert(1)</script>')).toThrow()
  })

  it('throws 400 for vbscript: scheme', () => {
    expect(() => validateTrackingUrl('vbscript:msgbox(1)')).toThrow()
  })

  it('throws 400 for non-URL input', () => {
    expect(() => validateTrackingUrl('not-a-url')).toThrow()
    expect(() => validateTrackingUrl('ftp://track.example.com/123')).toThrow()
  })
})
