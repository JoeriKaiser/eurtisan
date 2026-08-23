// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TermsPage from './TermsPage'

/**
 * Renders TermsPage against the real English message strings rather than a
 * hand-written mock. The DSA disclosures are legally load-bearing, so this test
 * must fail if the page stops rendering what the messages actually say — or if
 * a locale loses one of the `dsa_terms_*` strings.
 *
 * It reads `messages/*.json` directly because the generated `src/paraglide/`
 * output is produced by `make i18n-compile` and is never imported here.
 */

function repoRoot(): string {
  // `import.meta.dirname` exists under Node >= 20.11; fall back to the Vitest
  // working directory (the workspace root) when unavailable.
  return typeof import.meta.dirname === 'string'
    ? join(import.meta.dirname, '../../..')
    : process.cwd()
}

function readLocale(locale: 'en' | 'nl'): Record<string, string> {
  return JSON.parse(readFileSync(join(repoRoot(), `messages/${locale}.json`), 'utf8')) as Record<
    string,
    string
  >
}

vi.mock('#/paraglide/messages', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const messages = JSON.parse(readFileSync(join(repoRoot(), 'messages/en.json'), 'utf8')) as Record<
    string,
    string
  >

  const translate =
    (template: string) =>
    (params?: Record<string, string>): string =>
      template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
        params && key in params ? params[key] : placeholder,
      )

  return {
    m: new Proxy(
      {},
      {
        get: (_target, key: string) => {
          const template = messages[key]
          if (typeof template !== 'string') {
            throw new Error(`Unknown Paraglide message used by TermsPage: ${String(key)}`)
          }
          return translate(template)
        },
      },
    ),
  }
})

describe('TermsPage DSA sections', () => {
  it('renders the three DSA sections in order, before Contact Information', () => {
    render(<TermsPage />)

    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    const positionOf = (fragment: string): number => {
      const index = titles.findIndex((title) => title?.includes(fragment))
      expect(index, `expected a Terms section titled "${fragment}"`).toBeGreaterThan(-1)
      return index
    }

    const governingLaw = positionOf('Governing Law')
    const moderation = positionOf('Content Moderation')
    const pointsOfContact = positionOf('Points of Contact under the Digital Services Act')
    const microEnterprise = positionOf('Micro and Small Enterprise Status')
    const contactInformation = positionOf('Contact Information')

    expect(governingLaw).toBeLessThan(moderation)
    expect(moderation).toBeLessThan(pointsOfContact)
    expect(pointsOfContact).toBeLessThan(microEnterprise)
    expect(microEnterprise).toBeLessThan(contactInformation)
  })

  it('interpolates both designated addresses and leaves no raw placeholders', () => {
    const { container } = render(<TermsPage />)
    const text = container.textContent ?? ''

    expect(text).toContain('legal@eurtisan.eu')
    expect(text).toContain('support@eurtisan.eu')
    expect(text).not.toContain('{supportEmail}')
    expect(text).not.toContain('{legalEmail}')
  })
})

describe('dsa_terms message parity', () => {
  const EXPECTED_KEYS = [
    'dsa_terms_contacts_text',
    'dsa_terms_contacts_title',
    'dsa_terms_micro_text',
    'dsa_terms_micro_title',
    'dsa_terms_moderation_text',
    'dsa_terms_moderation_title',
  ]

  function placeholdersOf(template: string): string[] {
    return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
  }

  it('defines all six disclosure strings in both locales with matching placeholders', () => {
    const en = readLocale('en')
    const nl = readLocale('nl')

    const enKeys = Object.keys(en)
      .filter((key) => key.startsWith('dsa_terms_'))
      .sort()
    const nlKeys = Object.keys(nl)
      .filter((key) => key.startsWith('dsa_terms_'))
      .sort()

    expect(enKeys).toEqual(EXPECTED_KEYS)
    expect(nlKeys).toEqual(EXPECTED_KEYS)

    for (const key of enKeys) {
      expect(nl[key], `${key} must have a Dutch translation`).toBeTruthy()
      expect(placeholdersOf(en[key]), `${key} placeholders must match across locales`).toEqual(
        placeholdersOf(nl[key]),
      )
    }
  })
})
