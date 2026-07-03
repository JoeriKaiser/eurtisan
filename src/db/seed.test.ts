import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_DESCRIPTIONS,
  SHOP_DESCRIPTIONS,
  SUBCATEGORY_DESCRIPTIONS,
} from './seed-descriptions.ts'

function runSeed(args: string[] = [], env: Record<string, string> = {}): string {
  try {
    return execSync(`bun run src/db/seed.ts ${args.join(' ')}`, {
      env: { ...process.env, ...env },
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10_000,
    })
  } catch (error) {
    const e = error as Error & { stderr?: string; stdout?: string }
    return e.stderr || e.stdout || e.message
  }
}

describe('seed.ts production guards', () => {
  it('blocks seeding in production', () => {
    const output = runSeed([], { NODE_ENV: 'production' })
    expect(output).toContain('Seeding is disabled in production')
  })

  it('blocks clearing in production', () => {
    const output = runSeed(['--clear'], { NODE_ENV: 'production' })
    expect(output).toContain('Seeding is disabled in production')
  })

  it('requires --force alongside --clear in non-production', () => {
    const output = runSeed(['--clear'], { NODE_ENV: 'development' })
    expect(output).toContain('Use --force to confirm clearing data')
  })
})

describe('seed descriptions', () => {
  const forbidden = ['Pizza', 'Pants', 'elephant', 'LED lighting']

  function assertNoForbidden(description: string) {
    for (const word of forbidden) {
      expect(description.toLowerCase()).not.toContain(word.toLowerCase())
    }
  }

  it('does not use Faker placeholder words in category descriptions', () => {
    for (const [, description] of Object.entries(CATEGORY_DESCRIPTIONS)) {
      assertNoForbidden(description)
    }
  })

  it('does not use Faker placeholder words in subcategory descriptions', () => {
    for (const [, description] of Object.entries(SUBCATEGORY_DESCRIPTIONS)) {
      assertNoForbidden(description)
    }
  })

  it('does not use Faker placeholder words in random shop descriptions', () => {
    for (const description of SHOP_DESCRIPTIONS) {
      assertNoForbidden(description)
    }
  })
})
