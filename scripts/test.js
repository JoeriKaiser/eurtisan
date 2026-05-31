const { spawnSync } = require('child_process')

const args = process.argv.slice(2)

if (args.length === 0) {
  spawnSync('bunx', ['vitest', 'run', '--project', 'unit'], { stdio: 'inherit' })
  spawnSync('bunx', ['vitest', 'run', '--project', 'browser'], { stdio: 'inherit' })
} else {
  spawnSync('bunx', ['vitest', 'run', ...args], { stdio: 'inherit' })
}
