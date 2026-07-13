import { scanReleaseOutput, type ReleaseOutputScope } from '../src/lib/infra/release-output'

function usage(): never {
  throw new Error('Usage: run-checked-command.ts <build|test> -- <command> [args...]')
}

const [scopeValue, separator, ...command] = process.argv.slice(2)
if (
  (scopeValue !== 'build' && scopeValue !== 'test') ||
  separator !== '--' ||
  command.length === 0
) {
  usage()
}
const scope: ReleaseOutputScope = scopeValue

async function consume(
  stream: ReadableStream<Uint8Array>,
  destination: typeof Bun.stdout | typeof Bun.stderr,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    output += decoder.decode(value, { stream: true })
    destination.write(value)
  }

  output += decoder.decode()
  return output
}

const child = Bun.spawn(command, {
  cwd: process.cwd(),
  env: process.env,
  stdin: 'inherit',
  stdout: 'pipe',
  stderr: 'pipe',
})

const [stdout, stderr, exitCode] = await Promise.all([
  consume(child.stdout, Bun.stdout),
  consume(child.stderr, Bun.stderr),
  child.exited,
])

if (exitCode !== 0) process.exit(exitCode)

const issues = scanReleaseOutput(`${stdout}\n${stderr}`, scope)
if (issues.length > 0) {
  console.error(`Release output gate failed for ${scope}:`)
  for (const issue of issues) console.error(`- ${issue.id}: ${issue.message}`)
  process.exit(1)
}
