import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import {
  assertBrowserTestsDatabaseFree,
  BROWSER_TEST_DATABASE_FREE_ENV,
  classifyUnitTestFiles,
  collectTestFiles,
  extractCliArgs,
  matchFilterAgainstFiles,
  UNIT_TEST_CLASSIFICATION_ENV,
} from './vitest-test-classification'

interface SuiteDefinition {
  label: string
  command: string[]
  env?: Record<string, string>
}

interface SuiteResult {
  label: string
  exitCode: number
  stdout: string
  stderr: string
}

const classification = classifyUnitTestFiles()
assertBrowserTestsDatabaseFree()

const { database, pure } = classification
const defaultWorkers = Math.max(2, Math.min(4, os.cpus().length))
const workerCount = process.env.VITEST_PARALLEL_WORKERS ?? String(defaultWorkers)

const baseChildEnvironment = {
  ...process.env,
  [UNIT_TEST_CLASSIFICATION_ENV]: JSON.stringify(classification),
  [BROWSER_TEST_DATABASE_FREE_ENV]: 'true',
  VITEST_PARALLEL_WORKERS: workerCount,
}

const UNIT_DB_LOCK_PREFIX = existsSync('/usr/bin/flock')
  ? ['/usr/bin/flock', '/tmp/eurtisan-unit-db.lock']
  : []

const userArgs = process.argv.slice(2)
if (userArgs.length > 0) {
  const { filters, flagArgs, hasExplicitProject } = extractCliArgs(userArgs)
  const projectFlags: string[] = []
  let resolvedFilters = filters
  let needsDatabaseLock = true

  if (!hasExplicitProject && filters.length > 0) {
    const root = resolve(process.cwd())
    const browserFiles = collectTestFiles(join(root, 'src'), '.test.tsx').map((file) =>
      relative(root, file).split(sep).join('/'),
    )

    const matchedPure = new Set<string>()
    const matchedDatabase = new Set<string>()
    const matchedBrowser = new Set<string>()

    for (const filter of filters) {
      for (const file of matchFilterAgainstFiles(filter, pure)) matchedPure.add(file)
      for (const file of matchFilterAgainstFiles(filter, database)) matchedDatabase.add(file)
      for (const file of matchFilterAgainstFiles(filter, browserFiles)) matchedBrowser.add(file)
    }

    if (matchedPure.size > 0) projectFlags.push('--project', 'unit-pure')
    if (matchedDatabase.size > 0) projectFlags.push('--project', 'unit-db')
    if (matchedBrowser.size > 0) projectFlags.push('--project', 'browser')

    if (projectFlags.length === 0) {
      console.error(`No test files matched filter: ${filters.join(', ')}`)
      process.exit(1)
    }

    needsDatabaseLock = matchedDatabase.size > 0
    resolvedFilters = [...matchedPure, ...matchedDatabase, ...matchedBrowser]
  }

  const command = [
    ...(needsDatabaseLock ? UNIT_DB_LOCK_PREFIX : []),
    'bunx',
    'vitest',
    'run',
    ...projectFlags,
    ...flagArgs,
    ...resolvedFilters,
  ]
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    env: baseChildEnvironment,
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

const suites: SuiteDefinition[] = [
  {
    label: `database unit tests (${database.length} files, serial)`,
    command: [...UNIT_DB_LOCK_PREFIX, 'bunx', 'vitest', 'run', '--project', 'unit-db'],
  },
  {
    label: `pure unit tests (${pure.length} files, ${workerCount} workers)`,
    command: [
      'bunx',
      'vitest',
      'run',
      '--project',
      'unit-pure',
      '--fileParallelism',
      '--maxWorkers',
      workerCount,
    ],
  },
  {
    label: `browser tests (${workerCount} workers)`,
    command: [
      'bunx',
      'vitest',
      'run',
      '--project',
      'browser',
      '--fileParallelism',
      '--maxWorkers',
      workerCount,
    ],
    env: {
      [BROWSER_TEST_DATABASE_FREE_ENV]: 'true',
    },
  },
]

console.log('Running independent Vitest suites concurrently:')
for (const suite of suites) console.log(`- ${suite.label}`)

const results: SuiteResult[] = await Promise.all(
  suites.map(async (suite) => {
    const subprocess = Bun.spawn(suite.command, {
      cwd: process.cwd(),
      env: { ...baseChildEnvironment, ...suite.env },
      stdin: 'inherit',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      subprocess.exited,
      new Response(subprocess.stdout).text(),
      new Response(subprocess.stderr).text(),
    ])
    return { label: suite.label, exitCode, stdout, stderr }
  }),
)

const outputEncoder = new TextEncoder()
for (const result of results) {
  console.log(`\n===== ${result.label} =====`)
  if (result.stdout) Bun.stdout.write(outputEncoder.encode(result.stdout))
  if (result.stderr) {
    console.log(`----- ${result.label}: stderr -----`)
    Bun.stdout.write(outputEncoder.encode(result.stderr))
  }
}

const failures = results.filter((result) => result.exitCode !== 0)

if (failures.length > 0) {
  console.error('Vitest suite failures:')
  for (const failure of failures) {
    console.error(`- ${failure.label}: exit ${failure.exitCode}`)
  }
  process.exit(1)
}
