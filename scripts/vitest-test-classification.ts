import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

export function collectTestFiles(directory: string, suffix: '.test.ts' | '.test.tsx'): string[] {
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

interface ParsedModuleMetadata {
  mtimeMs: number
  size: number
  runtimeSpecifiers: string[]
  browserSpecifiers: string[]
  isServerContract: boolean
}

const AST_CACHE_RELATIVE_PATH = 'node_modules/.cache/eurtisan-vitest-ast-cache.json'
const memoryAstCache = new Map<string, ParsedModuleMetadata>()
let diskAstCacheLoaded = false
let diskAstCacheDirty = false

function loadDiskAstCache(projectRoot: string): void {
  if (diskAstCacheLoaded) return
  diskAstCacheLoaded = true
  const cachePath = join(projectRoot, AST_CACHE_RELATIVE_PATH)
  if (!existsSync(cachePath)) return
  try {
    const parsed = JSON.parse(readFileSync(cachePath, 'utf8')) as Record<
      string,
      ParsedModuleMetadata
    >
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (
          value &&
          typeof value.mtimeMs === 'number' &&
          typeof value.size === 'number' &&
          Array.isArray(value.runtimeSpecifiers) &&
          Array.isArray(value.browserSpecifiers) &&
          typeof value.isServerContract === 'boolean'
        ) {
          memoryAstCache.set(key, value)
        }
      }
    }
  } catch {
    // Ignore corrupt or outdated cache files
  }
}

function flushDiskAstCache(projectRoot: string): void {
  if (!diskAstCacheDirty) return
  diskAstCacheDirty = false
  const cachePath = join(projectRoot, AST_CACHE_RELATIVE_PATH)
  try {
    mkdirSync(dirname(cachePath), { recursive: true })
    const serialized: Record<string, ParsedModuleMetadata> = {}
    for (const [key, value] of memoryAstCache.entries()) {
      serialized[key] = value
    }
    writeFileSync(cachePath, JSON.stringify(serialized), 'utf8')
  } catch {
    // Best-effort cache persistence
  }
}

function parseModuleMetadata(path: string, useCache: boolean): ParsedModuleMetadata {
  let mtimeMs = 0
  let size = 0
  if (useCache) {
    const stat = statSync(path)
    mtimeMs = stat.mtimeMs
    size = stat.size
    const cached = memoryAstCache.get(path)
    if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
      return cached
    }
  }

  const source = readFileSync(path, 'utf8')
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

  const isServerContract = sourceFile.statements.some(
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

  const runtimeSpecifiers: string[] = []
  const browserSpecifiers: string[] = []

  function visit(node: ts.Node, inServerImplementation: boolean): void {
    if (
      !inServerImplementation &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === 'handler' || node.expression.name.text === 'server') &&
      referencesServerFactory(node.expression.expression)
    ) {
      // TanStack removes server function and request-middleware implementations
      // from browser bundles. Their imports cannot execute in browser tests.
      visit(node.expression, false)
      for (const arg of node.arguments) {
        visit(arg, true)
      }
      return
    }

    let specifier: string | null = null
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importClauseHasRuntimeValue(node.importClause)
    ) {
      specifier = node.moduleSpecifier.text
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifier = node.moduleSpecifier.text
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      specifier = node.arguments[0].text
    }

    if (specifier !== null) {
      runtimeSpecifiers.push(specifier)
      if (!inServerImplementation) {
        browserSpecifiers.push(specifier)
      }
    }

    ts.forEachChild(node, (child) => visit(child, inServerImplementation))
  }

  visit(sourceFile, false)

  const metadata: ParsedModuleMetadata = {
    mtimeMs,
    size,
    runtimeSpecifiers,
    browserSpecifiers,
    isServerContract,
  }

  if (useCache) {
    memoryAstCache.set(path, metadata)
    diskAstCacheDirty = true
  }
  return metadata
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
  const useCache = projectRoot === resolve(process.cwd())
  if (useCache) loadDiskAstCache(projectRoot)

  const importCache = new Map<string, string[]>()
  const databasePathCache = new Map<string, string[] | null>()
  function localDependencies(path: string): string[] {
    const cached = importCache.get(path)
    if (cached) return cached

    const metadata = parseModuleMetadata(path, useCache)
    const specifiers = browserRuntime ? metadata.browserSpecifiers : metadata.runtimeSpecifiers
    const dependencies = specifiers
      .map((specifier) => resolveLocalModule(projectRoot, path, specifier))
      .filter((dependency): dependency is string => dependency !== null)
    importCache.set(path, dependencies)
    return dependencies
  }

  function findDatabasePath(
    path: string,
    visiting: Set<string>,
    entryPoint: boolean,
  ): { path: string[] | null; hitCycle: boolean } {
    if (isDatabaseBoundary(projectRoot, path)) return { path: [path], hitCycle: false }
    if (browserRuntime && !entryPoint && parseModuleMetadata(path, useCache).isServerContract) {
      // TanStack compiles these modules into client stubs and removes their
      // implementation-only imports. The production build separately enforces
      // that server-only code cannot leak into the browser bundle.
      return { path: null, hitCycle: false }
    }

    if (!entryPoint && databasePathCache.has(path)) {
      return { path: databasePathCache.get(path) ?? null, hitCycle: false }
    }
    if (visiting.has(path)) return { path: null, hitCycle: true }

    visiting.add(path)
    let result: string[] | null = null
    let hitCycle = false
    for (const dependency of localDependencies(path)) {
      const dep = findDatabasePath(dependency, visiting, false)
      if (dep.hitCycle) hitCycle = true
      if (dep.path) {
        result = [path, ...dep.path]
        break
      }
    }
    visiting.delete(path)

    // Cache positive paths unconditionally, and cache negative results only when
    // the traversal did not depend on skipping an active cycle ancestor.
    if (!entryPoint && (result !== null || !hitCycle)) {
      databasePathCache.set(path, result)
    }
    return { path: result, hitCycle }
  }

  return { findDatabasePath, useCache }
}

export function classifyUnitTestFiles(projectRoot = process.cwd()): UnitTestClassification {
  const root = resolve(projectRoot)
  const tests = collectTestFiles(join(root, 'src'), '.test.ts')
  const { findDatabasePath, useCache } = createDependencyClassifier(root)
  const classification: UnitTestClassification = { database: [], pure: [] }

  for (const test of tests) {
    const relativePath = toPosixPath(relative(root, test))
    if (findDatabasePath(test, new Set<string>(), false).path !== null) {
      classification.database.push(relativePath)
    } else {
      classification.pure.push(relativePath)
    }
  }

  if (useCache) flushDiskAstCache(root)
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
  if (serialized === undefined) {
    const computed = classifyUnitTestFiles(projectRoot)
    if (resolve(projectRoot) === resolve(process.cwd())) {
      process.env[UNIT_TEST_CLASSIFICATION_ENV] = JSON.stringify(computed)
    }
    return computed
  }

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

export const BROWSER_TEST_DATABASE_FREE_ENV = 'VITEST_BROWSER_TESTS_VERIFIED'

export function assertBrowserTestsDatabaseFree(
  projectRoot = process.cwd(),
  verified?: string,
): void {
  const root = resolve(projectRoot)
  const isDefaultRoot = root === resolve(process.cwd())
  const isExplicitlyVerified = verified !== undefined ? verified === 'true' : false
  const isEnvVerified = process.env[BROWSER_TEST_DATABASE_FREE_ENV] === 'true'

  if (isExplicitlyVerified || (isDefaultRoot && isEnvVerified)) return

  const tests = collectTestFiles(join(root, 'src'), '.test.tsx')
  const { findDatabasePath, useCache } = createDependencyClassifier(root, true)
  const violations = tests.flatMap((test) => {
    const dependencyPath = findDatabasePath(test, new Set<string>(), true).path
    if (!dependencyPath) return []
    return [dependencyPath.map((path) => toPosixPath(relative(root, path))).join(' -> ')]
  })
  if (useCache) flushDiskAstCache(root)
  if (violations.length > 0) {
    throw new Error(
      `Browser tests must not transitively import database modules because they run concurrently with database-backed unit tests:\n${violations.join('\n')}`,
    )
  }

  if (isDefaultRoot && verified === undefined) {
    process.env[BROWSER_TEST_DATABASE_FREE_ENV] = 'true'
  }
}

const VALUE_TAKING_VITEST_FLAGS: Record<string, true> = {
  '-t': true,
  '--testNamePattern': true,
  '--reporter': true,
  '--outputFile': true,
  '-c': true,
  '--config': true,
  '-r': true,
  '--root': true,
  '--dir': true,
  '--pool': true,
  '--maxWorkers': true,
  '--minWorkers': true,
  '--environment': true,
  '--shard': true,
  '--bail': true,
  '--retry': true,
  '--testTimeout': true,
  '--hookTimeout': true,
  '--teardownTimeout': true,
  '--sequence': true,
  '--project': true,
}

export interface ExtractedCliArgs {
  filters: string[]
  flagArgs: string[]
  hasExplicitProject: boolean
}

export function extractCliArgs(args: string[]): ExtractedCliArgs {
  const filters: string[] = []
  const flagArgs: string[] = []
  let hasExplicitProject = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--') {
      for (let j = i + 1; j < args.length; j++) {
        if (args[j].startsWith('-')) flagArgs.push(args[j])
        else filters.push(args[j])
      }
      break
    }
    if (arg === '--project' || arg.startsWith('--project=')) {
      hasExplicitProject = true
    }
    if (VALUE_TAKING_VITEST_FLAGS[arg]) {
      flagArgs.push(arg)
      if (i + 1 < args.length) {
        flagArgs.push(args[i + 1])
        i++
      }
      continue
    }
    if (arg.startsWith('-')) {
      flagArgs.push(arg)
      continue
    }
    filters.push(arg)
  }
  return { filters, flagArgs, hasExplicitProject }
}

export function matchFilterAgainstFiles(rawFilter: string, files: string[]): string[] {
  const normalized = rawFilter.replace(/\\/g, '/').replace(/^\.\//, '')
  const directMatches = files.filter((file) => file.includes(normalized))
  if (directMatches.length > 0) return directMatches

  // Recover dynamic route test paths when Make ($c) or shell ($param) expanded unescaped $ segments
  return files.filter(
    (file) =>
      file.includes('$') &&
      (file.replace(/\$[A-Za-z0-9_]+/g, '').includes(normalized) ||
        file.replace(/\$[A-Za-z0-9_]/g, '').includes(normalized)),
  )
}
