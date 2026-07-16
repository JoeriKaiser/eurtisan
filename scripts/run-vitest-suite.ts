import { classifyUnitTestFiles } from './vitest-test-classification'

interface SuiteDefinition {
  label: string
  command: string[]
}

interface SuiteProcess {
  label: string
  process: ReturnType<typeof Bun.spawn>
}

async function forward(
  stream: ReadableStream<Uint8Array>,
  destination: typeof Bun.stdout | typeof Bun.stderr,
): Promise<void> {
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) return
    destination.write(value)
  }
}

const { database, pure } = classifyUnitTestFiles()
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

const processes: SuiteProcess[] = suites.map((suite) => ({
  label: suite.label,
  process: Bun.spawn(suite.command, {
    cwd: process.cwd(),
    env: process.env,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  }),
}))

const results = await Promise.all(
  processes.map(async (suite) => {
    const [exitCode] = await Promise.all([
      suite.process.exited,
      forward(suite.process.stdout, Bun.stdout),
      forward(suite.process.stderr, Bun.stderr),
    ])
    return { label: suite.label, exitCode }
  }),
)
const failures = results.filter((result) => result.exitCode !== 0)

if (failures.length > 0) {
  console.error('Vitest suite failures:')
  for (const failure of failures) {
    console.error(`- ${failure.label}: exit ${failure.exitCode}`)
  }
  process.exit(1)
}
