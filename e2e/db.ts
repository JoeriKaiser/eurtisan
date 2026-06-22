/**
 * E2E database connection — isolated from the development database.
 *
 * Set `E2E_DATABASE_URL` (see Makefile `db-seed-e2e` / `make e2e`).
 */
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from '../src/db/schema'

const connectionString =
  process.env.E2E_DATABASE_URL ?? 'postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test'

export const e2ePool = new Pool({ connectionString })
export const db = drizzle(e2ePool, { schema })
