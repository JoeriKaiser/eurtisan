import { assertValidServerEnvironment } from '../src/lib/infra/server-environment.server'

assertValidServerEnvironment(process.env)
console.log('Server environment configuration is valid.')
