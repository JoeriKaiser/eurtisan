import { eq } from 'drizzle-orm'
import { pool } from '../db.ts'
import { db } from './index.ts'
import { account, categories, product, shop, todos, user } from './schema.ts'

async function seed() {
  // Seed todos
  const existingTodos = await db.select().from(todos)
  if (existingTodos.length === 0) {
    await db
      .insert(todos)
      .values([
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
  const existingCreator = await db
    .select()
    .from(user)
    .where(eq(user.email, 'creator@eurtisan.local'))
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
      password:
        'f2867747b76f33fb95f454d2c2fabe35:a46362e9e227f1d1d4a3485be43a107d23f16ebfceb29c9820cfb4309e8531ad1f1678e1b9cb951d5ee9e90632c028796e7edf06b2105208fd7acc899f5b2642',
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

  const existingCustomer = await db
    .select()
    .from(user)
    .where(eq(user.email, 'customer@eurtisan.local'))
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

  let shopId: string
  const existingShop = await db.select().from(shop).where(eq(shop.slug, 'the-forge'))
  if (existingShop.length === 0) {
    shopId = crypto.randomUUID()
    await db.insert(shop).values({
      id: shopId,
      ownerId: creatorId,
      name: 'The Forge',
      slug: 'the-forge',
      description: 'Handcrafted goods from the heart of Europe.',
    })
    console.log('Shop seeded successfully.')
  } else {
    shopId = existingShop[0].id
  }

  // Seed categories
  const categoryData = [
    { name: 'Ceramics', slug: 'ceramics' },
    { name: 'Textiles', slug: 'textiles' },
    { name: 'Woodwork', slug: 'woodwork' },
    { name: 'Jewellery', slug: 'jewellery' },
    { name: 'Fine Art', slug: 'fine-art' },
    { name: 'Botanical', slug: 'botanical' },
  ]

  const categoryIds = new Map<string, string>()
  for (const cat of categoryData) {
    const existing = await db.select().from(categories).where(eq(categories.slug, cat.slug))
    if (existing.length === 0) {
      const [inserted] = await db.insert(categories).values(cat).returning()
      categoryIds.set(cat.slug, inserted.id)
      console.log(`Category "${cat.name}" seeded.`)
    } else {
      categoryIds.set(cat.slug, existing[0].id)
    }
  }

  // Seed products
  const existingProducts = await db.select().from(product)
  if (existingProducts.length === 0) {
    const productsData = [
      {
        name: 'Hand-thrown Stoneware Bowl',
        slug: 'hand-thrown-stoneware-bowl',
        description: 'A rustic breakfast bowl, glazed in warm earth tones. Each piece is unique.',
        priceCents: 3800,
        categorySlug: 'ceramics',
      },
      {
        name: 'Linen Tea Towel Set',
        slug: 'linen-tea-towel-set',
        description: 'Set of two heavyweight linen tea towels, naturally dyed in moss green.',
        priceCents: 2400,
        categorySlug: 'textiles',
      },
      {
        name: 'Oak Cutting Board',
        slug: 'oak-cutting-board',
        description: 'Solid European oak, finished with beeswax and mineral oil.',
        priceCents: 5600,
        categorySlug: 'woodwork',
      },
      {
        name: 'Silver Hammered Ring',
        slug: 'silver-hammered-ring',
        description: 'Hand-hammered sterling silver band with a soft, organic texture.',
        priceCents: 7200,
        categorySlug: 'jewellery',
      },
      {
        name: 'Watercolour Landscape Print',
        slug: 'watercolour-landscape-print',
        description: 'Limited edition giclée print of a Portuguese valley in morning light.',
        priceCents: 4500,
        categorySlug: 'fine-art',
      },
      {
        name: 'Dried Herb Wreath',
        slug: 'dried-herb-wreath',
        description: 'Lavender, rosemary and eucalyptus, hand-tied and air-dried.',
        priceCents: 3200,
        categorySlug: 'botanical',
      },
      {
        name: 'Porcelain Espresso Cups (pair)',
        slug: 'porcelain-espresso-cups',
        description: 'Thin-walled porcelain with a celadon glaze. Sold as a pair.',
        priceCents: 4200,
        categorySlug: 'ceramics',
      },
      {
        name: 'Wool Throw Blanket',
        slug: 'wool-throw-blanket',
        description: 'Chunky knit Portuguese wool in undyed cream. Generous size.',
        priceCents: 12800,
        categorySlug: 'textiles',
      },
    ]

    for (const p of productsData) {
      const categoryId = categoryIds.get(p.categorySlug)
      await db.insert(product).values({
        id: crypto.randomUUID(),
        name: p.name,
        slug: p.slug,
        description: p.description,
        priceCents: p.priceCents,
        shopId,
        categoryId,
      })
      console.log(`Product "${p.name}" seeded.`)
    }
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
