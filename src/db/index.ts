import { drizzle } from 'drizzle-orm/node-postgres'

import { pool } from '../db.ts'
import * as schema from './schema.ts'

export const db = drizzle(pool, { schema })
