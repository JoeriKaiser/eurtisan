import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  assertBrowserTestsDatabaseFree,
  classifyUnitTestFiles,
  loadUnitTestClassification,
} from '../../scripts/vitest-test-classification'

const temporaryProjects: string[] = []

function createProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'eurtisan-vitest-classification-'))
  temporaryProjects.push(root)

  for (const [path, contents] of Object.entries(files)) {
    const absolutePath = join(root, path)
    mkdirSync(join(absolutePath, '..'), { recursive: true })
    writeFileSync(absolutePath, contents)
  }
  return root
}

afterEach(() => {
  for (const project of temporaryProjects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe('classifyUnitTestFiles', () => {
  it('separates transitively database-backed tests from pure tests', () => {
    const root = createProject({
      'src/db/index.ts': 'export const db = {}',
      'src/lib/repository.ts': "import { db } from '#/db/index'\nexport const repository = db",
      'src/lib/repository.test.ts': "import { repository } from './repository'\nvoid repository",
      'src/lib/pricing.test.ts': 'const total = 2 + 2\nvoid total',
    })

    expect(classifyUnitTestFiles(root)).toEqual({
      database: ['src/lib/repository.test.ts'],
      pure: ['src/lib/pricing.test.ts'],
    })
  })

  it('finds database dependencies through import cycles', () => {
    const root = createProject({
      'src/db/index.ts': 'export const db = {}',
      'src/lib/first.ts':
        "import { second } from './second'\nimport { db } from '#/db/index'\nexport const first = second ?? db",
      'src/lib/second.ts': "import { first } from './first'\nexport const second = first",
      'src/lib/second.test.ts': "import { second } from './second'\nvoid second",
    })

    expect(classifyUnitTestFiles(root).database).toEqual(['src/lib/second.test.ts'])
  })

  it('does not treat type-only database imports as runtime dependencies', () => {
    const root = createProject({
      'src/db/schema.ts': 'export interface Product { id: string }',
      'src/lib/product.test.ts':
        "import type { Product } from '#/db/schema'\nconst product: Product = { id: 'one' }\nvoid product",
    })

    expect(classifyUnitTestFiles(root).pure).toEqual(['src/lib/product.test.ts'])
  })
})

describe('loadUnitTestClassification', () => {
  it('loads a validated precomputed classification', () => {
    const classification = {
      database: ['src/lib/repository.test.ts'],
      pure: ['src/lib/pricing.test.ts'],
    }

    expect(loadUnitTestClassification('/unused', JSON.stringify(classification))).toEqual(
      classification,
    )
  })

  it('rejects malformed precomputed classifications', () => {
    expect(() =>
      loadUnitTestClassification('/unused', JSON.stringify({ database: [], pure: ['bad.ts'] })),
    ).toThrow('contains an invalid test classification')
  })
})

describe('assertBrowserTestsDatabaseFree', () => {
  it('rejects direct runtime database imports', () => {
    const root = createProject({
      'src/db/index.ts': 'export const db = {}',
      'src/components/Card.test.tsx': "import { db } from '#/db/index'\nvoid db",
    })

    expect(() => assertBrowserTestsDatabaseFree(root)).toThrow(
      'src/components/Card.test.tsx -> src/db/index.ts',
    )
  })

  it('rejects transitive runtime database imports with the dependency path', () => {
    const root = createProject({
      'src/db/index.ts': 'export const db = {}',
      'src/lib/repository.ts': "import { db } from '#/db/index'\nexport const repository = db",
      'src/components/Card.tsx':
        "import { repository } from '../lib/repository'\nexport const Card = repository",
      'src/components/Card.test.tsx': "import { Card } from './Card'\nvoid Card",
    })

    expect(() => assertBrowserTestsDatabaseFree(root)).toThrow(
      'src/components/Card.test.tsx -> src/components/Card.tsx -> src/lib/repository.ts -> src/db/index.ts',
    )
  })

  it('ignores database imports inside TanStack server implementations', () => {
    const root = createProject({
      'src/db/index.ts': 'export const db = {}',
      'src/lib/contract.ts':
        "import { createServerFn } from '@tanstack/react-start'\nexport const action = createServerFn().handler(async () => import('#/db/index'))",
      'src/components/Card.test.tsx': "import { action } from '../lib/contract'\nvoid action",
    })

    expect(() => assertBrowserTestsDatabaseFree(root)).not.toThrow()
  })

  it('allows type-only database imports', () => {
    const root = createProject({
      'src/db/schema.ts': 'export interface Product { id: string }',
      'src/components/Card.test.tsx':
        "import type { Product } from '#/db/schema'\nconst product: Product = { id: 'one' }\nvoid product",
    })

    expect(() => assertBrowserTestsDatabaseFree(root)).not.toThrow()
  })
})
