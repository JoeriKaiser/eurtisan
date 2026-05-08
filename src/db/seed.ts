import { eq } from 'drizzle-orm'
import { pool } from '../db.ts'
import { db } from './index.ts'
import { account, shop, todos, user } from './schema.ts'

async function seed() {
  // Seed todos
  const existingTodos = await db.select().from(todos)
  if (existingTodos.length === 0) {
    await db.insert(todos).values([
      { title: 'Set up artisan profile page' },
      { title: 'Configure GDPR-compliant cookie banner' },
      { title: 'Design product listing card component' },
      { title: 'Implement Euro pricing formatter' },
      { title: 'Set up Sentry error tracking' },
    ])
    console.log('Todos seeded successfully.')
  }

  // Seed users and shop
  let creatorId: string
  const existingCreator = await db.select().from(user).where(eq(user.email, 'creator@eurtisan.local'))
  if (existingCreator.length === 0) {
    creatorId = crypto.randomUUID()
    await db.insert(user).values({
      id: creatorId,
      name: 'Eurtisan Creator',
      email: 'creator@eurtisan.local',
      emailVerified: true,
      role: 'creator',
    })

    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: creatorId,
      providerId: 'credential',
      userId: creatorId,
      password: 'f2867747b76f33fb95f454d2c2fabe35:a46362e9e227f1d1d4a3485be43a107d23f16ebfceb29c9820cfb4309e8531ad1f1678e1b9cb951d5ee9e90632c028796e7edf06b2105208fd7acc899f5b2642',
    })

    console.log('Creator user and account seeded successfully.')
  } else {
    creatorId = existingCreator[0].id
  }

  const existingAdmin = await db.select().from(user).where(eq(user.email, 'admin@eurtisan.local'))
  if (existingAdmin.length === 0) {
    await db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Admin User',
      email: 'admin@eurtisan.local',
      emailVerified: true,
      role: 'admin',
    })
    console.log('Admin user seeded successfully.')
  }

  const existingCustomer = await db.select().from(user).where(eq(user.email, 'customer@eurtisan.local'))
  if (existingCustomer.length === 0) {
    await db.insert(user).values({
      id: crypto.randomUUID(),
      name: 'Customer User',
      email: 'customer@eurtisan.local',
      emailVerified: true,
      role: 'customer',
    })
    console.log('Customer user seeded successfully.')
  }

  const existingShop = await db.select().from(shop).where(eq(shop.slug, 'the-forge'))
  if (existingShop.length === 0) {
    await db.insert(shop).values({
      id: crypto.randomUUID(),
      ownerId: creatorId,
      name: 'The Forge',
      slug: 'the-forge',
      description: 'Handcrafted goods from the heart of Europe.',
    })
    console.log('Shop seeded successfully.')
  }

  console.log('Seed completed.')
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
