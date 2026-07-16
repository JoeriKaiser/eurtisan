import { classifyUnitTestFiles, UNIT_TEST_CLASSIFICATION_ENV } from './vitest-test-classification'

interface SuiteDefinition {
  label: string
  command: string[]
}

interface SuiteResult {
  label: string
  exitCode: number
  stdout: string
  stderr: string
}

const classification = classifyUnitTestFiles()
const { database, pure } = classification
const workerCount = process.env.VITEST_PARALLEL_WORKERS ?? '2'

const suites: SuiteDefinition[] = [
  {
    label: `database unit tests (${database.length} files, serial)`,
    command: ['bunx', 'vitest', 'run', '--project', 'unit-db'],
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
  },
]

console.log('Running independent Vitest suites concurrently:')
for (const suite of suites) console.log(`- ${suite.label}`)

const childEnvironment = {
  ...process.env,
  [UNIT_TEST_CLASSIFICATION_ENV]: JSON.stringify(classification),
}

const results: SuiteResult[] = await Promise.all(
  suites.map(async (suite) => {
    const subprocess = Bun.spawn(suite.command, {
      cwd: process.cwd(),
      env: childEnvironment,
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
