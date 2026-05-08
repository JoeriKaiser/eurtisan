import { pool } from '../db.ts'
import { db } from './index.ts'
import { todos } from './schema.ts'

async function seed() {
  const existing = await db.select().from(todos)
  if (existing.length > 0) {
    console.log('Database already seeded, skipping.')
    return
  }

  await db.insert(todos).values([
    { title: 'Set up artisan profile page' },
    { title: 'Configure GDPR-compliant cookie banner' },
    { title: 'Design product listing card component' },
    { title: 'Implement Euro pricing formatter' },
    { title: 'Set up Sentry error tracking' },
  ])

  console.log('Database seeded successfully.')
}

seed()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Seed failed:', err)
    await pool.end()
    process.exit(1)
  })
