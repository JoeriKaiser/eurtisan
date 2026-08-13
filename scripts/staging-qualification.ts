import { writeFileSync } from 'node:fs'

import {
  createStagingQualificationDraft,
  runPublicStagingChecks,
  validateStagingQualificationEvidence,
} from '../src/lib/infra/staging-qualification'

function readArguments(values: string[]): Map<string, string> {
  const result = new Map<string, string>()
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index]
    const value = values[index + 1]
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid argument near ${name ?? '<end>'}`)
    }
    result.set(name.slice(2), value)
  }
  return result
}

function required(argumentsMap: Map<string, string>, name: string): string {
  const value = argumentsMap.get(name)
  if (!value) throw new Error(`--${name} is required`)
  return value
}

const [command, ...argumentValues] = process.argv.slice(2)
const argumentsMap = readArguments(argumentValues)

if (command === 'create') {
  const output = required(argumentsMap, 'output')
  const draft = createStagingQualificationDraft({
    qualificationId: required(argumentsMap, 'qualification-id'),
    euRegion: required(argumentsMap, 'eu-region'),
    startedAt: new Date().toISOString(),
    gitSha: required(argumentsMap, 'git-sha'),
    imageRepository: required(argumentsMap, 'image-repository'),
    imageDigest: required(argumentsMap, 'image-digest'),
    publicConfigDigest: required(argumentsMap, 'public-config-digest'),
  })
  writeFileSync(output, `${JSON.stringify(draft, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  console.log(`Created honest not-run qualification draft at ${output}`)
} else if (command === 'validate') {
  const evidencePath = required(argumentsMap, 'evidence')
  const evidence = await Bun.file(evidencePath).json()
  validateStagingQualificationEvidence(evidence, { final: argumentsMap.get('final') === 'true' })
  console.log(
    `Staging qualification evidence is valid (${argumentsMap.get('final') === 'true' ? 'final' : 'draft'} mode)`,
  )
} else if (command === 'smoke') {
  const results = await runPublicStagingChecks({
    baseUrl: required(argumentsMap, 'base-url'),
    expectedRelease: required(argumentsMap, 'expected-release'),
  })
  console.log(
    JSON.stringify({ schemaVersion: 1, observedAt: new Date().toISOString(), results }, null, 2),
  )
  if (results.some(({ status }) => status === 'failed')) process.exit(1)
} else {
  throw new Error('Usage: staging-qualification.ts <create|validate|smoke> [--name value ...]')
}
