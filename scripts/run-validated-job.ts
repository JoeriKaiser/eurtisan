import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { assertValidServerEnvironment } from '../src/lib/infra/server-environment.server'

const jobPath = process.argv[2]
if (!jobPath || !/^src\/jobs\/[A-Za-z0-9-]+\.ts$/.test(jobPath)) {
  throw new Error('A valid src/jobs/<job-name>.ts path is required')
}

assertValidServerEnvironment(process.env)
if (process.env.VALIDATE_ENV_ONLY === 'true') {
  console.log(`Environment configuration is valid for ${jobPath}.`)
  process.exit(0)
}

await import(pathToFileURL(resolve(jobPath)).href)
