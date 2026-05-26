import { getProductBySlugQuery } from '../src/lib/products.server.ts'
import { pool } from '../src/db.ts'

async function run() {
  const result = await getProductBySlugQuery('the-forge', 'natural-oak-stool')
  console.log('Result:', JSON.stringify(result, null, 2))
  await pool.end()
}

run()
