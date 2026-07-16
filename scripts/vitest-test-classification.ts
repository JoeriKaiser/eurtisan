import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

export interface UnitTestClassification {
  database: string[]
  pure: string[]
}

export const UNIT_TEST_CLASSIFICATION_ENV = 'VITEST_UNIT_TEST_CLASSIFICATION'

const SOURCE_EXTENSIONS = ['.ts', '.tsx'] as const

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

function collectTestFiles(directory: string, suffix: '.test.ts' | '.test.tsx'): string[] {
  if (!existsSync(directory)) return []

  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path, suffix))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(resolve(path))
    }
  }
  return files.sort()
}

function importClauseHasRuntimeValue(importClause: ts.ImportClause | undefined): boolean {
  if (!importClause) return true
  if (importClause.isTypeOnly) return false
  if (importClause.name) return true

  const bindings = importClause.namedBindings
  if (!bindings || ts.isNamespaceImport(bindings)) return true
  return bindings.elements.some((element) => !element.isTypeOnly)
}

function referencesServerFactory(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === 'createMiddleware' || expression.text === 'createServerFn'
  }
  if (ts.isCallExpression(expression)) return referencesServerFactory(expression.expression)
  if (ts.isPropertyAccessExpression(expression)) {
    return referencesServerFactory(expression.expression)
  }
  return false
}

function runtimeModuleSpecifiers(path: string, browserRuntime: boolean): string[] {
  const source = readFileSync(path, 'utf8')
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const specifiers: string[] = []

  function visit(node: ts.Node): void {
    if (
      browserRuntime &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === 'handler' || node.expression.name.text === 'server') &&
      referencesServerFactory(node.expression.expression)
    ) {
      // TanStack removes server function and request-middleware implementations
      // from browser bundles. Their imports cannot execute in browser tests.
      visit(node.expression)
      return
    }

    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importClauseHasRuntimeValue(node.importClause)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifiers.push(node.arguments[0].text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return specifiers
}

function resolveLocalModule(
  projectRoot: string,
  importer: string,
  specifier: string,
): string | null {
  let basePath: string
  if (specifier.startsWith('#/') || specifier.startsWith('@/')) {
    basePath = resolve(projectRoot, 'src', specifier.slice(2))
  } else if (specifier.startsWith('.')) {
    basePath = resolve(dirname(importer), specifier)
  } else {
    return null
  }

  const candidates = [
    basePath,
    ...SOURCE_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(basePath, `index${extension}`)),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return resolve(candidate)
  }
  return null
}

function isDatabaseBoundary(projectRoot: string, path: string): boolean {
  const relativePath = toPosixPath(relative(projectRoot, path))
  return relativePath === 'src/db.ts' || relativePath.startsWith('src/db/')
}

function createDependencyClassifier(projectRoot: string, browserRuntime = false) {
  const importCache = new Map<string, string[]>()
  const serverContractCache = new Map<string, boolean>()
  const databasePathCache = new Map<string, string[]>()

  function isTanStackServerContract(path: string): boolean {
    const cached = serverContractCache.get(path)
    if (cached !== undefined) return cached

    const source = readFileSync(path, 'utf8')
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false)
    const result = sourceFile.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '@tanstack/react-start' &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.some(
          (element) =>
            element.name.text === 'createMiddleware' || element.name.text === 'createServerFn',
        ),
    )
    serverContractCache.set(path, result)
    return result
  }

  function localDependencies(path: string): string[] {
    const cached = importCache.get(path)
    if (cached) return cached

    const dependencies = runtimeModuleSpecifiers(path, browserRuntime)
      .map((specifier) => resolveLocalModule(projectRoot, path, specifier))
      .filter((dependency): dependency is string => dependency !== null)
    importCache.set(path, dependencies)
    return dependencies
  }

  function databaseDependencyPath(
    path: string,
    visiting = new Set<string>(),
    entryPoint = false,
  ): string[] | null {
    if (isDatabaseBoundary(projectRoot, path)) return [path]
    if (browserRuntime && !entryPoint && isTanStackServerContract(path)) {
      // TanStack compiles these modules into client stubs and removes their
      // implementation-only imports. The production build separately enforces
      // that server-only code cannot leak into the browser bundle.
      return null
    }

    const cached = databasePathCache.get(path)
    if (cached) return cached
    if (visiting.has(path)) return null

    visiting.add(path)
    let result: string[] | null = null
    for (const dependency of localDependencies(path)) {
      const dependencyPath = databaseDependencyPath(dependency, visiting)
      if (dependencyPath) {
        result = [path, ...dependencyPath]
        break
      }
    }
    visiting.delete(path)

    // Cache successful paths only. Caching a negative result discovered while
    // traversing a cycle can incorrectly hide a path through an ancestor.
    if (result) databasePathCache.set(path, result)
    return result
  }

  function reachesDatabase(path: string): boolean {
    return databaseDependencyPath(path) !== null
  }

  return { databaseDependencyPath, reachesDatabase }
}

export function classifyUnitTestFiles(projectRoot = process.cwd()): UnitTestClassification {
  const root = resolve(projectRoot)
  const tests = collectTestFiles(join(root, 'src'), '.test.ts')
  const { reachesDatabase } = createDependencyClassifier(root)
  const classification: UnitTestClassification = { database: [], pure: [] }

  for (const test of tests) {
    const relativePath = toPosixPath(relative(root, test))
    if (reachesDatabase(test)) classification.database.push(relativePath)
    else classification.pure.push(relativePath)
  }

  return classification
}

function isUnitTestClassification(value: unknown): value is UnitTestClassification {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<UnitTestClassification>
  const isTestFileList = (files: unknown): files is string[] =>
    Array.isArray(files) &&
    files.every(
      (file) => typeof file === 'string' && file.startsWith('src/') && file.endsWith('.test.ts'),
    )

  if (!isTestFileList(candidate.database) || !isTestFileList(candidate.pure)) return false
  return (
    new Set([...candidate.database, ...candidate.pure]).size ===
    candidate.database.length + candidate.pure.length
  )
}

export function loadUnitTestClassification(
  projectRoot = process.cwd(),
  serialized = process.env[UNIT_TEST_CLASSIFICATION_ENV],
): UnitTestClassification {
  if (serialized === undefined) return classifyUnitTestFiles(projectRoot)

  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    throw new Error(`${UNIT_TEST_CLASSIFICATION_ENV} must contain valid JSON`, { cause: error })
  }

  if (!isUnitTestClassification(parsed)) {
    throw new Error(`${UNIT_TEST_CLASSIFICATION_ENV} contains an invalid test classification`)
  }
  return parsed
}

export function assertBrowserTestsDatabaseFree(projectRoot = process.cwd()): void {
  const root = resolve(projectRoot)
  const tests = collectTestFiles(join(root, 'src'), '.test.tsx')
  const { databaseDependencyPath } = createDependencyClassifier(root, true)
  const violations = tests.flatMap((test) => {
    const dependencyPath = databaseDependencyPath(test, new Set<string>(), true)
    if (!dependencyPath) return []
    return [dependencyPath.map((path) => toPosixPath(relative(root, path))).join(' -> ')]
  })

  if (violations.length > 0) {
    throw new Error(
      `Browser tests must not transitively import database modules because they run concurrently with database-backed unit tests:\n${violations.join('\n')}`,
    )
  }
}
