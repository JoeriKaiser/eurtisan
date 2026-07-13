import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { contrastRatio, type OklchColor } from './contrast'

const color = (lightness: number, chroma: number, hue: number): OklchColor => ({
  lightness,
  chroma,
  hue,
})

const lightSurface = color(0.97, 0.005, 75)
const darkSurface = color(0.1, 0.012, 75)

describe('theme contrast assurance', () => {
  it.each([
    ['primary text', color(0.18, 0.014, 75), lightSurface],
    ['secondary and muted text', color(0.42, 0.02, 75), lightSurface],
    ['primary action', color(0.97, 0.005, 75), color(0.44, 0.08, 145)],
    ['error text', color(0.48, 0.15, 25), lightSurface],
    ['success text', color(0.43, 0.12, 130), lightSurface],
    ['dark primary text', color(0.93, 0.008, 75), darkSurface],
    ['dark secondary text', color(0.76, 0.016, 75), darkSurface],
    ['dark muted text', color(0.64, 0.02, 75), darkSurface],
    ['dark primary action', color(0.1, 0.012, 75), color(0.62, 0.09, 145)],
    ['dark error text', color(0.62, 0.16, 25), darkSurface],
  ])('%s meets WCAG AA normal-text contrast', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['light focus ring', color(0.47, 0.09, 175), lightSurface],
    ['dark focus ring', color(0.47, 0.09, 175), darkSurface],
  ])('%s meets non-text UI contrast', (_name, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3)
  })
})

describe('localized accessibility labels', () => {
  it('provides non-empty English and Dutch names for shared navigation and async states', () => {
    expect(m.pagination_label(undefined, { locale: 'en' })).toBe('Pagination')
    expect(m.pagination_label(undefined, { locale: 'nl' })).toBe('Paginering')
    expect(m.nav_skip_to_content(undefined, { locale: 'en' })).toBe('Skip to main content')
    expect(m.nav_skip_to_content(undefined, { locale: 'nl' })).toBe('Ga naar de hoofdinhoud')
    expect(m.dispute_loading(undefined, { locale: 'nl' })).toContain('Geschilgegevens')
  })
})

describe('responsive and user-preference static contracts', () => {
  const styles = readFileSync('src/styles.css', 'utf8')
  const rootRoute = readFileSync('src/routes/__root.tsx', 'utf8')
  const rootComponent = readFileSync('src/route-components/__root.tsx', 'utf8')
  const rootDocument = readFileSync('src/route-components/root/RootDocument.tsx', 'utf8')

  it('does not disable browser zoom and preserves narrow-layout text wrapping', () => {
    expect(rootRoute).toContain('width=device-width, initial-scale=1')
    expect(rootRoute).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i)
    expect(rootDocument).toContain('[overflow-wrap:anywhere]')
  })

  it('defines reduced-motion and forced-colors behavior without hiding focus', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
    expect(styles).toContain('@media (forced-colors: active)')
    expect(styles).toContain(':focus-visible')
    expect(styles).not.toMatch(/:focus(?:-visible)?[^{}]*\{[^{}]*outline:\s*(?:0|none)[^{}]*\}/s)
  })

  it('keeps skip navigation localized, focusable, and linked to the outlet target', () => {
    expect(rootComponent).toContain("href='#main-content'")
    expect(rootComponent).toContain('m.nav_skip_to_content()')
    expect(rootComponent).toContain("id='main-content'")
    expect(rootComponent).toContain('tabIndex={-1}')
  })
})
