import { describe, expect, it } from 'vitest'
import { buildRobotsTxt } from './robots-txt.server'

const disallowedPaths = ['/cart', '/checkout', '/creator', '/admin', '/api', '/orders']

describe('buildRobotsTxt', () => {
  it('starts with User-agent: *', () => {
    const content = buildRobotsTxt()
    expect(content).toContain('User-agent: *')
  })

  it('disallows all private routes', () => {
    const content = buildRobotsTxt()
    for (const path of disallowedPaths) {
      expect(content).toContain(`Disallow: ${path}`)
    }
  })

  it('includes a sitemap reference', () => {
    const content = buildRobotsTxt()
    expect(content).toContain('Sitemap:')
    expect(content).toContain('/sitemap.xml')
  })

  it('does not disallow public routes', () => {
    const content = buildRobotsTxt()
    const disallowLines = content
      .split('\n')
      .filter((line) => line.startsWith('Disallow:'))
      .map((line) => line.replace('Disallow:', '').trim())

    // Only the specified paths should be disallowed
    for (const path of disallowLines) {
      expect(disallowedPaths).toContain(path)
    }
  })

  it('produces a non-empty output', () => {
    const content = buildRobotsTxt()
    expect(content.length).toBeGreaterThan(0)
  })
})
