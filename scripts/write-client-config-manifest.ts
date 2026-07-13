import { mkdir, writeFile } from 'node:fs/promises'

import {
  parsePublicBuildEnvironment,
  selectExplicitPublicBuildEnvironment,
  toPublicEnvironmentManifest,
} from '../src/lib/infra/public-environment'

const environment = parsePublicBuildEnvironment(
  process.env.EURTISAN_PUBLIC_ENV_ONLY === 'true'
    ? selectExplicitPublicBuildEnvironment(process.env)
    : process.env,
)
const outputDirectory = new URL('../dist/client/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
await writeFile(
  new URL('client-config.json', outputDirectory),
  `${JSON.stringify(toPublicEnvironmentManifest(environment), null, 2)}\n`,
  { encoding: 'utf8', mode: 0o644 },
)
