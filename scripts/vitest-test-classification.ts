import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

interface UnitTestClassification {
  database: string[]
  pure: string[]
}

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

function runtimeModuleSpecifiers(path: string): string[] {
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

function createDependencyClassifier(projectRoot: string) {
  const importCache = new Map<string, string[]>()
  const databaseCache = new Map<string, boolean>()

  function localDependencies(path: string): string[] {
    const cached = importCache.get(path)
    if (cached) return cached

    const dependencies = runtimeModuleSpecifiers(path)
      .map((specifier) => resolveLocalModule(projectRoot, path, specifier))
      .filter((dependency): dependency is string => dependency !== null)
    importCache.set(path, dependencies)
    return dependencies
  }

  function reachesDatabase(path: string, visiting = new Set<string>()): boolean {
    if (isDatabaseBoundary(projectRoot, path)) return true

    const cached = databaseCache.get(path)
    if (cached !== undefined) return cached
    if (visiting.has(path)) return false

    visiting.add(path)
    const result = localDependencies(path).some((dependency) =>
      reachesDatabase(dependency, visiting),
    )
    visiting.delete(path)
    databaseCache.set(path, result)
    return result
  }

  return { localDependencies, reachesDatabase }
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

export function assertBrowserTestsDatabaseFree(projectRoot = process.cwd()): void {
  const root = resolve(projectRoot)
  const tests = collectTestFiles(join(root, 'src'), '.test.tsx')
  const { localDependencies } = createDependencyClassifier(root)
  const violations = tests.flatMap((test) => {
    const databaseImports = localDependencies(test).filter((dependency) =>
      isDatabaseBoundary(root, dependency),
    )
    return databaseImports.map(
      (dependency) =>
        `${toPosixPath(relative(root, test))} -> ${toPosixPath(relative(root, dependency))}`,
    )
  })

  if (violations.length > 0) {
    throw new Error(
      `Browser tests must not directly import database modules because they run concurrently with database-backed unit tests:\n${violations.join('\n')}`,
    )
  }
}
