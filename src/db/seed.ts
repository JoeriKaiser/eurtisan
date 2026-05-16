import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  faker,
  fakerDA,
  fakerDE,
  fakerDE_AT,
  fakerDE_CH,
  fakerEL,
  fakerES,
  fakerFR,
  fakerFR_BE,
  fakerHU,
  fakerIT,
  fakerNL,
  fakerNL_BE,
  fakerPL,
  fakerPT_PT,
  fakerSV,
} from '@faker-js/faker'
import { sql } from 'drizzle-orm'
import { pool } from '../db.ts'
import { db } from './index.ts'
import * as schema from './schema.ts'

// =============================================================================
// Configuration
// =============================================================================
const CONFIG = {
  admins: 6,
  creators: 35,
  customers: 100,
  shopsPerCreator: { min: 0, max: 2 },
  categories: 15,
  subcategoriesPerCategory: { min: 0, max: 3 },
  productsPerShop: { min: 4, max: 22 },
  imagesPerProduct: { min: 1, max: 5 },
  carts: 50,
  itemsPerCart: { min: 1, max: 6 },
  platformOrders: 180,
  itemsPerOrder: { min: 1, max: 5 },
  reviewsRate: 0.65,
  payouts: 60,
  notifications: 300,
  disputes: 15,
  todos: 10,
}

/** Shared password hash for all seeded credential accounts. */
const PASSWORD_HASH =
  'f2867747b76f33fb95f454d2c2fabe35:a46362e9e227f1d1d4a3485be43a107d23f16ebfceb29c9820cfb4309e8531ad1f1678e1b9cb951d5ee9e90632c028796e7edf06b2105208fd7acc899f5b2642'

const PRODUCTS_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const SHOPS_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'shops')
const _IMAGE_DOWNLOAD_CONCURRENCY = 15

async function _asyncPool<T, R>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  const iterator = items.entries()
  async function worker() {
    for (const [i, item] of iterator) {
      results[i] = await fn(item)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function _downloadImage(url: string, destPath: string): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true })
  let lastErr: Error | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = await res.arrayBuffer()
      await writeFile(destPath, new Uint8Array(buffer))
      return
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error(`Failed to download ${url} after 2 attempts: ${lastErr?.message}`)
}

const LOCALES = [
  fakerDE,
  fakerFR,
  fakerIT,
  fakerNL,
  fakerES,
  fakerPT_PT,
  fakerPL,
  fakerEL,
  fakerSV,
  fakerDA,
  fakerHU,
  fakerDE_AT,
  fakerFR_BE,
  fakerNL_BE,
  fakerDE_CH,
]

// =============================================================================
// Utilities
// =============================================================================
function randomLocale() {
  return faker.helpers.arrayElement(LOCALES)
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = slugify(base)
  let counter = 2
  while (existing.has(slug)) {
    slug = `${slugify(base)}-${counter++}`
  }
  existing.add(slug)
  return slug
}

function productImageUrl(seed: string, width = 800, height = 600): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`
}

function avatarUrl(email: string): string {
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`
}

function shopImageUrl(seed: string): string {
  return `https://picsum.photos/seed/${seed}/1200/400`
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function makeAddress(locale: ReturnType<typeof randomLocale>) {
  return {
    name: locale.person.fullName(),
    line1: locale.location.streetAddress({ useFullAddress: true }),
    line2: faker.helpers.maybe(() => locale.location.secondaryAddress(), { probability: 0.3 }),
    city: locale.location.city(),
    postalCode: locale.location.zipCode(),
    country: locale.location.country(),
  }
}

// =============================================================================
// Clear existing data
// =============================================================================
async function clearAll() {
  console.log('Clearing existing data...')
  const tables = [
    'dispute_message',
    'shipping_label',
    'review',
    'order_item',
    'inventory_reservation',
    'cart_item',
    'dispute',
    'shop_order',
    'platform_order',
    'cart',
    'product_image',
    'product',
    'notification',
    'payout',
    'shop',
    'category',
    'session',
    'account',
    'verification',
    'user',
    'todos',
    'rate_limit',
  ]
  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
  }
  await rm(PRODUCTS_UPLOAD_DIR, { recursive: true, force: true })
  await rm(SHOPS_UPLOAD_DIR, { recursive: true, force: true })
  console.log('All tables cleared.')
}

// =============================================================================
// Users & Accounts
// =============================================================================
async function seedUsers() {
  console.log('Seeding users...')
  const users: (typeof schema.user.$inferInsert)[] = []
  const accounts: (typeof schema.account.$inferInsert)[] = []

  // Known test accounts
  const known = [
    { name: 'Admin User', email: 'admin@eurtisan.local', role: 'admin' as const },
    { name: 'Eurtisan Creator', email: 'creator@eurtisan.local', role: 'creator' as const },
    { name: 'Customer User', email: 'customer@eurtisan.local', role: 'customer' as const },
  ]

  for (const k of known) {
    const id = crypto.randomUUID()
    users.push({
      id,
      name: k.name,
      email: k.email,
      emailVerified: true,
      role: k.role,
      image: avatarUrl(k.email),
    })
    if (k.role !== 'customer') {
      accounts.push({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: PASSWORD_HASH,
      })
    }
  }

  // Random admins
  for (let i = 0; i < CONFIG.admins; i++) {
    const locale = randomLocale()
    const email = `admin.${i + 1}@eurtisan.local`
    users.push({
      id: crypto.randomUUID(),
      name: `${locale.person.firstName()} ${locale.person.lastName()}`,
      email,
      emailVerified: true,
      role: 'admin',
      image: avatarUrl(email),
    })
  }

  // Random creators
  for (let i = 0; i < CONFIG.creators; i++) {
    const locale = randomLocale()
    const email = `creator.${i + 1}@eurtisan.local`
    const id = crypto.randomUUID()
    users.push({
      id,
      name: `${locale.person.firstName()} ${locale.person.lastName()}`,
      email,
      emailVerified: true,
      role: 'creator',
      image: avatarUrl(email),
    })
    accounts.push({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: PASSWORD_HASH,
    })
  }

  // Random customers
  for (let i = 0; i < CONFIG.customers; i++) {
    const locale = randomLocale()
    const email = `customer.${i + 1}@eurtisan.local`
    const id = crypto.randomUUID()
    users.push({
      id,
      name: `${locale.person.firstName()} ${locale.person.lastName()}`,
      email,
      emailVerified: faker.datatype.boolean(0.9),
      role: 'customer',
      image: avatarUrl(email),
    })
    if (Math.random() > 0.5) {
      accounts.push({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: PASSWORD_HASH,
      })
    }
  }

  await db.insert(schema.user).values(users)
  if (accounts.length > 0) {
    await db.insert(schema.account).values(accounts)
  }

  console.log(`  ${users.length} users, ${accounts.length} accounts`)
  return users
}

// =============================================================================
// Shops
// =============================================================================
async function seedShops(users: (typeof schema.user.$inferInsert)[]) {
  console.log('Seeding shops...')
  const creators = users.filter((u) => u.role === 'creator')
  const shops: (typeof schema.shop.$inferInsert)[] = []
  const shopSlugs = new Set<string>()

  const prefixes = [
    'Atelier',
    'Studio',
    'The',
    'Maison',
    'Werkstatt',
    'Bottega',
    'Taller',
    'Oficina',
    "L'",
    'La ',
    'Le ',
    'Der ',
    'Die ',
    'Het ',
    'O ',
    'A ',
  ]
  const suffixes = [
    'Forge',
    'Gather',
    'Makers',
    'Craft',
    'Handmade',
    'Artisan',
    'Collective',
    'Works',
    'Goods',
    'Corner',
    'Market',
    'Foundry',
    'Workshop',
    'Studio',
    'Atelier',
    'House',
    'Haven',
    'Nest',
  ]

  for (const creator of creators) {
    const count = faker.number.int(CONFIG.shopsPerCreator)
    for (let i = 0; i < count; i++) {
      const name = `${faker.helpers.arrayElement(prefixes)}${faker.helpers.arrayElement(suffixes)}`
        .replace(/\s+/g, ' ')
        .trim()
      const locale = randomLocale()
      const slug = uniqueSlug(name, shopSlugs)
      shops.push({
        id: crypto.randomUUID(),
        ownerId: creator.id!,
        name,
        slug,
        description: faker.commerce.productDescription(),
        image: shopImageUrl(slug),
        shippingOrigin: {
          city: locale.location.city(),
          country: locale.location.country(),
        },
        isSuspended: faker.datatype.boolean(0.03),
      })
    }
  }

  // Ensure known creator has at least one shop
  const knownCreator = creators.find((u) => u.email === 'creator@eurtisan.local')
  if (knownCreator && !shops.some((s) => s.ownerId === knownCreator.id)) {
    const slug = uniqueSlug('The Forge', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'The Forge',
      slug,
      description: 'Handcrafted goods from the heart of Europe.',
      image: shopImageUrl('the-forge'),
      shippingOrigin: { city: 'Brussels', country: 'Belgium' },
      isSuspended: false,
    })
  }

  // Image downloads disabled — seed uses external placeholder URLs directly.
  // To re-enable local image storage, restore the downloadImage loop below.
  // console.log('  Downloading shop banners...')
  // await asyncPool(IMAGE_DOWNLOAD_CONCURRENCY, shops, async (shop) => {
  //   if (!shop.image) return
  //   const filename = `banner.jpg`
  //   const dest = join(SHOPS_UPLOAD_DIR, shop.id!, filename)
  //   await downloadImage(shop.image, dest)
  //   shop.image = `/uploads/shops/${shop.id!}/${filename}`
  // })

  if (shops.length > 0) {
    await db.insert(schema.shop).values(shops)
  }

  console.log(`  ${shops.length} shops`)
  return shops
}

// =============================================================================
// Categories (with subcategories)
// =============================================================================
async function seedCategories() {
  console.log('Seeding categories...')

  const defs = [
    { name: 'Ceramics', subs: ['Pottery', 'Porcelain', 'Stoneware'] },
    { name: 'Textiles', subs: ['Weaving', 'Embroidery', 'Knitwear'] },
    { name: 'Woodwork', subs: ['Carving', 'Furniture', 'Kitchenware'] },
    { name: 'Jewellery', subs: ['Silver', 'Gold', 'Beaded'] },
    { name: 'Fine Art', subs: ['Painting', 'Printmaking', 'Sculpture'] },
    { name: 'Botanical', subs: ['Dried Flowers', 'Herbs', 'Wreaths'] },
    { name: 'Leather', subs: ['Bags', 'Belts', 'Accessories'] },
    { name: 'Glass', subs: ['Stained Glass', 'Blown Glass', 'Mosaic'] },
    { name: 'Metalwork', subs: ['Blacksmith', 'Copper', 'Pewter'] },
    { name: 'Paper Goods', subs: ['Stationery', 'Books', 'Prints'] },
    { name: 'Candles', subs: ['Soy Candles', 'Beeswax', 'Aromatherapy'] },
    { name: 'Furniture', subs: ['Chairs', 'Tables', 'Storage'] },
    { name: 'Soap & Bath', subs: ['Bar Soap', 'Bath Bombs', 'Skincare'] },
    { name: 'Food & Drink', subs: ['Preserves', 'Honey', 'Spices'] },
    { name: 'Musical Instruments', subs: ['Flutes', 'Percussion', 'Strings'] },
  ]

  const categories: (typeof schema.categories.$inferInsert)[] = []
  const categoryIds = new Map<string, string>()
  const slugSet = new Set<string>()

  for (const def of defs) {
    const slug = uniqueSlug(def.name, slugSet)
    const id = crypto.randomUUID()
    categoryIds.set(def.name, id)
    categories.push({
      id,
      name: def.name,
      slug,
      description: faker.commerce.productDescription(),
    })
  }

  if (categories.length > 0) {
    await db.insert(schema.categories).values(categories)
  }

  const subCategories: (typeof schema.categories.$inferInsert)[] = []
  for (const def of defs) {
    const parentId = categoryIds.get(def.name)!
    const subCount = faker.number.int(CONFIG.subcategoriesPerCategory)
    for (const sub of def.subs.slice(0, subCount)) {
      const slug = uniqueSlug(`${def.name}-${sub}`, slugSet)
      const id = crypto.randomUUID()
      categoryIds.set(`${def.name}-${sub}`, id)
      subCategories.push({
        id,
        name: sub,
        slug,
        description: faker.commerce.productDescription(),
        parentId,
      })
    }
  }

  if (subCategories.length > 0) {
    await db.insert(schema.categories).values(subCategories)
  }

  console.log(`  ${categories.length} categories, ${subCategories.length} subcategories`)
  return [...categories, ...subCategories]
}

// =============================================================================
// Products & Images
// =============================================================================
async function seedProducts(
  shops: (typeof schema.shop.$inferInsert)[],
  categories: (typeof schema.categories.$inferInsert)[],
) {
  console.log('Seeding products...')
  const products: (typeof schema.product.$inferInsert)[] = []
  const productImages: (typeof schema.productImage.$inferInsert)[] = []
  const productSlugsByShop = new Map<string, Set<string>>()

  const templates = [
    'Hand-thrown {adjective} {noun}',
    'Artisan {material} {noun}',
    'Limited Edition {adjective} {noun}',
    'Traditional {region} {noun}',
    'Organic {material} {noun}',
    'Vintage-style {adjective} {noun}',
    'Rustic {material} {noun}',
    'Elegant {adjective} {noun}',
    'Hand-stitched {material} {noun}',
    'Bespoke {adjective} {noun}',
    'Natural {material} {noun}',
    'Heritage {region} {noun}',
    'Small-batch {adjective} {noun}',
    'Slow-made {material} {noun}',
  ]

  const adjectives = [
    'Rustic',
    'Elegant',
    'Minimal',
    'Warm',
    'Earthy',
    'Delicate',
    'Bold',
    'Soft',
    'Textured',
    'Polished',
    'Raw',
    'Refined',
    'Whimsical',
    'Timeless',
    'Vintage',
    'Modern',
    'Classic',
    'Bohemian',
    'Nordic',
    'Mediterranean',
  ]
  const materials = [
    'Oak',
    'Walnut',
    'Linen',
    'Cotton',
    'Wool',
    'Silk',
    'Ceramic',
    'Stoneware',
    'Porcelain',
    'Brass',
    'Copper',
    'Silver',
    'Leather',
    'Beeswax',
    'Clay',
    'Bamboo',
    'Cork',
    'Lace',
    'Velvet',
    'Hemp',
    'Lavender',
    'Olive Wood',
  ]
  const nouns = [
    'Bowl',
    'Vase',
    'Plate',
    'Cup',
    'Saucer',
    'Tray',
    'Box',
    'Frame',
    'Mirror',
    'Lamp',
    'Candle',
    'Pillow',
    'Blanket',
    'Scarf',
    'Necklace',
    'Ring',
    'Earring',
    'Bracelet',
    'Bag',
    'Wallet',
    'Belt',
    'Cutting Board',
    'Spoon',
    'Coaster',
    'Planter',
    'Wreath',
    'Print',
    'Painting',
    'Sketchbook',
    'Journal',
    'Card',
    'Ornament',
    'Mobile',
    'Clock',
    'Shelf',
    'Stool',
    'Basket',
    'Tote',
    'Apron',
    'Mug',
    'Teapot',
    'Jug',
    'Candle Holder',
  ]
  const regions = [
    'Provençal',
    'Tuscan',
    'Scandinavian',
    'Alpine',
    'Baltic',
    'Mediterranean',
    'Celtic',
    'Nordic',
    'Bohemian',
    'Andalusian',
    'Provence',
    'Moorish',
    'Tyrolean',
    'Danish',
    'Portuguese',
    'Moroccan',
  ]

  for (const shop of shops) {
    const count = faker.number.int(CONFIG.productsPerShop)
    if (!productSlugsByShop.has(shop.id!)) {
      productSlugsByShop.set(shop.id!, new Set())
    }
    const slugSet = productSlugsByShop.get(shop.id!)!

    for (let i = 0; i < count; i++) {
      const name = faker.helpers
        .arrayElement(templates)
        .replace('{adjective}', faker.helpers.arrayElement(adjectives))
        .replace('{material}', faker.helpers.arrayElement(materials))
        .replace('{noun}', faker.helpers.arrayElement(nouns))
        .replace('{region}', faker.helpers.arrayElement(regions))

      const slug = uniqueSlug(name, slugSet)
      const priceCents = faker.number.int({ min: 499, max: 74999 }) // €4.99 – €749.99
      const stockCount = faker.number.int({ min: 0, max: 150 })
      const category = faker.helpers.maybe(() => faker.helpers.arrayElement(categories), {
        probability: 0.85,
      })
      const productId = crypto.randomUUID()

      products.push({
        id: productId,
        name,
        slug,
        description: faker.commerce.productDescription(),
        priceCents,
        stockCount,
        isActive: stockCount > 0 && faker.datatype.boolean(0.88),
        shopId: shop.id!,
        categoryId: category?.id,
      })

      const imgCount = faker.number.int(CONFIG.imagesPerProduct)
      for (let j = 0; j < imgCount; j++) {
        productImages.push({
          id: crypto.randomUUID(),
          productId,
          url: productImageUrl(`${slug}-${j}`, 800 + j * 50, 600 + j * 50),
          altText: `${name} — view ${j + 1}`,
          sortOrder: j,
        })
      }
    }
  }

  // Image downloads disabled — seed uses external placeholder URLs directly.
  // console.log('  Downloading product images...')
  // await asyncPool(IMAGE_DOWNLOAD_CONCURRENCY, productImages, async (img) => {
  //   const filename = `img-${img.sortOrder}.jpg`
  //   const dest = join(PRODUCTS_UPLOAD_DIR, img.productId, filename)
  //   await downloadImage(img.url, dest)
  //   img.url = `/uploads/products/${img.productId}/${filename}`
  // })

  for (const c of chunk(products, 100)) {
    await db.insert(schema.product).values(c)
  }
  for (const c of chunk(productImages, 200)) {
    await db.insert(schema.productImage).values(c)
  }

  console.log(`  ${products.length} products, ${productImages.length} images`)
  return products
}

// =============================================================================
// Carts
// =============================================================================
async function seedCarts(
  users: (typeof schema.user.$inferInsert)[],
  products: (typeof schema.product.$inferInsert)[],
) {
  console.log('Seeding carts...')
  const customers = users.filter((u) => u.role === 'customer')
  const carts: (typeof schema.cart.$inferInsert)[] = []
  const cartItems: (typeof schema.cartItem.$inferInsert)[] = []

  for (let i = 0; i < CONFIG.carts; i++) {
    const customer = faker.helpers.arrayElement(customers)
    const cartId = crypto.randomUUID()
    carts.push({
      id: cartId,
      userId: customer.id,
      expiresAt: faker.date.future({ years: 0.25 }),
    })

    const itemCount = faker.number.int(CONFIG.itemsPerCart)
    const used = new Set<string>()
    for (let j = 0; j < itemCount; j++) {
      const p = faker.helpers.arrayElement(products)
      if (used.has(p.id!)) continue
      used.add(p.id!)
      cartItems.push({
        id: crypto.randomUUID(),
        cartId,
        productId: p.id!,
        quantity: faker.number.int({ min: 1, max: 5 }),
      })
    }
  }

  if (carts.length > 0) await db.insert(schema.cart).values(carts)
  if (cartItems.length > 0) await db.insert(schema.cartItem).values(cartItems)

  console.log(`  ${carts.length} carts, ${cartItems.length} items`)
}

// =============================================================================
// Orders, Items, Reviews, Disputes, Shipping Labels, Inventory Reservations
// =============================================================================
async function seedOrders(
  users: (typeof schema.user.$inferInsert)[],
  shops: (typeof schema.shop.$inferInsert)[],
  products: (typeof schema.product.$inferInsert)[],
) {
  console.log('Seeding orders...')
  const customers = users.filter((u) => u.role === 'customer')

  const platformOrders: (typeof schema.platformOrder.$inferInsert)[] = []
  const shopOrders: (typeof schema.shopOrder.$inferInsert)[] = []
  const orderItems: (typeof schema.orderItem.$inferInsert)[] = []
  const inventoryReservations: (typeof schema.inventoryReservation.$inferInsert)[] = []
  const shippingLabels: (typeof schema.shippingLabel.$inferInsert)[] = []
  const reviews: (typeof schema.review.$inferInsert)[] = []
  const disputes: (typeof schema.dispute.$inferInsert)[] = []
  const disputeMessages: (typeof schema.disputeMessage.$inferInsert)[] = []

  // Group products by shop
  const productsByShop = new Map<string, (typeof schema.product.$inferInsert)[]>()
  for (const p of products) {
    if (!productsByShop.has(p.shopId)) productsByShop.set(p.shopId, [])
    productsByShop.get(p.shopId)?.push(p)
  }

  const shopEntries = Array.from(productsByShop.entries()).map(([shopId, products]) => ({
    shopId,
    products,
  }))

  // Realistic status distribution
  const statusPool = [
    ...Array(3).fill('pending_payment'),
    ...Array(3).fill('paid'),
    ...Array(3).fill('processing'),
    ...Array(5).fill('shipped'),
    ...Array(7).fill('delivered'),
    ...Array(8).fill('completed'),
    'cancelled',
    'cancelled',
    'refunded',
    'disputed',
  ] as (typeof schema.orderStatusEnum.enumValues)[number][]

  for (let i = 0; i < CONFIG.platformOrders; i++) {
    const customer = faker.helpers.arrayElement(customers)
    const locale = randomLocale()
    const shippingAddress = makeAddress(locale)
    const billingAddress = makeAddress(locale)
    const status = faker.helpers.arrayElement(statusPool)
    const orderDate = faker.date.past({ years: 1 })
    const platformOrderId = crypto.randomUUID()
    const totalCents = faker.number.int({ min: 1200, max: 120000 })

    platformOrders.push({
      id: platformOrderId,
      userId: customer.id!,
      shippingAddress,
      billingAddress,
      totalCents,
      status,
      cancelledAt: status === 'cancelled' ? faker.date.recent({ days: 30 }) : undefined,
      cancellationReason:
        status === 'cancelled'
          ? faker.helpers.arrayElement([
              'Changed mind',
              'Item out of stock',
              'Shipping too expensive',
              'Ordered by mistake',
              'Found cheaper elsewhere',
            ])
          : undefined,
      molliePaymentId: faker.datatype.boolean(0.75)
        ? `tr_${faker.string.alphanumeric(10)}`
        : undefined,
      createdAt: orderDate,
      updatedAt: orderDate,
    })

    const shopCount = faker.number.int({ min: 1, max: 3 })
    const usedShops = new Set<string>()

    for (let s = 0; s < shopCount; s++) {
      const entry = faker.helpers.arrayElement(shopEntries)
      if (usedShops.has(entry.shopId)) continue
      usedShops.add(entry.shopId)

      const shopOrderId = crypto.randomUUID()
      const shopStatus =
        status === 'pending_payment'
          ? 'pending_payment'
          : status === 'paid'
            ? faker.helpers.arrayElement(['paid', 'processing'])
            : status

      const subtotalCents = Math.floor(totalCents / shopCount)
      const shippingCostCents = faker.number.int({ min: 399, max: 2499 })

      shopOrders.push({
        id: shopOrderId,
        platformOrderId,
        shopId: entry.shopId,
        shippingMethod: faker.helpers.arrayElement(schema.shippingMethodEnum.enumValues),
        shippingCostCents,
        subtotalCents,
        status: shopStatus,
        trackingNumber: ['shipped', 'delivered', 'completed', 'disputed'].includes(shopStatus)
          ? faker.string.alphanumeric(12).toUpperCase()
          : undefined,
        trackingUrl: ['shipped', 'delivered', 'completed', 'disputed'].includes(shopStatus)
          ? `https://track.eurtisan.eu/${faker.string.alphanumeric(8)}`
          : undefined,
        deliveredAt: ['delivered', 'completed'].includes(shopStatus)
          ? faker.date.recent({ days: 60 })
          : undefined,
        createdAt: orderDate,
        updatedAt: orderDate,
      })

      // Order items
      const itemCount = faker.number.int(CONFIG.itemsPerOrder)
      const usedProducts = new Set<string>()
      for (let k = 0; k < itemCount; k++) {
        const p = faker.helpers.arrayElement(entry.products)
        if (usedProducts.has(p.id!)) continue
        usedProducts.add(p.id!)
        const quantity = faker.number.int({ min: 1, max: 4 })
        const unitPriceCents = p.priceCents
        orderItems.push({
          id: crypto.randomUUID(),
          shopOrderId,
          productId: p.id!,
          productName: p.name!,
          unitPriceCents,
          quantity,
          totalCents: unitPriceCents * quantity,
          createdAt: orderDate,
        })
      }

      // Shipping labels
      if (['shipped', 'delivered', 'completed'].includes(shopStatus)) {
        shippingLabels.push({
          id: crypto.randomUUID(),
          shopOrderId,
          carrier: faker.helpers.arrayElement([
            'DHL',
            'DPD',
            'GLS',
            'PostNL',
            'La Poste',
            'Royal Mail',
            'Deutsche Post',
            'Packeta',
            'Colissimo',
          ]),
          trackingNumber: faker.string.alphanumeric(12).toUpperCase(),
          labelUrl: `https://label.eurtisan.eu/${faker.string.alphanumeric(16)}.pdf`,
          createdAt: orderDate,
        })
      }

      // Reviews for delivered / completed
      if (['delivered', 'completed'].includes(shopStatus) && Math.random() < CONFIG.reviewsRate) {
        const soItems = orderItems.filter((oi) => oi.shopOrderId === shopOrderId)
        for (const item of soItems) {
          if (faker.datatype.boolean(0.45)) continue
          reviews.push({
            id: crypto.randomUUID(),
            shopOrderId,
            productId: item.productId!,
            buyerUserId: customer.id!,
            rating: faker.number.int({ min: 1, max: 5 }),
            comment: faker.helpers.maybe(
              () => faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
              { probability: 0.75 },
            ),
            createdAt: faker.date.soon({
              days: 14,
              refDate: shopOrders[shopOrders.length - 1].deliveredAt ?? orderDate,
            }),
          })
        }
      }

      // Disputes
      if (shopStatus === 'disputed' && faker.datatype.boolean(0.6)) {
        const disputeId = crypto.randomUUID()
        const ownerId = shops.find((sh) => sh.id === entry.shopId)?.ownerId ?? customer.id!
        disputes.push({
          id: disputeId,
          shopOrderId,
          buyerUserId: customer.id!,
          reason: faker.helpers.arrayElement([
            'Item not as described',
            'Damaged in transit',
            'Wrong item sent',
            'Quality issue',
            'Counterfeit',
            'Missing parts',
          ]),
          description: faker.lorem.paragraphs(2),
          status: faker.helpers.arrayElement(['open', 'resolved', 'closed']),
          resolution: faker.helpers.maybe(
            () =>
              faker.helpers.arrayElement([
                'Refund issued',
                'Replacement sent',
                'Partial refund',
                'No action taken',
              ]),
            { probability: 0.6 },
          ),
          refundCents: faker.helpers.maybe(
            () => faker.number.int({ min: 500, max: subtotalCents }),
            { probability: 0.4 },
          ),
          createdAt: orderDate,
          updatedAt: orderDate,
        })

        const msgCount = faker.number.int({ min: 2, max: 8 })
        for (let m = 0; m < msgCount; m++) {
          disputeMessages.push({
            id: crypto.randomUUID(),
            disputeId,
            senderUserId: m % 2 === 0 ? customer.id! : ownerId,
            message: faker.lorem.sentences(faker.number.int({ min: 1, max: 5 })),
            createdAt: faker.date.soon({ days: m * 2 + 1, refDate: orderDate }),
          })
        }
      }

      // Inventory reservations for pending_payment
      if (status === 'pending_payment') {
        const soItems = orderItems.filter((oi) => oi.shopOrderId === shopOrderId)
        for (const item of soItems) {
          inventoryReservations.push({
            id: crypto.randomUUID(),
            productId: item.productId!,
            quantity: item.quantity,
            platformOrderId,
            expiresAt: faker.date.soon({ days: 1, refDate: orderDate }),
            createdAt: orderDate,
          })
        }
      }
    }
  }

  for (const c of chunk(platformOrders, 100)) await db.insert(schema.platformOrder).values(c)
  for (const c of chunk(shopOrders, 100)) await db.insert(schema.shopOrder).values(c)
  for (const c of chunk(orderItems, 200)) await db.insert(schema.orderItem).values(c)
  for (const c of chunk(inventoryReservations, 100))
    await db.insert(schema.inventoryReservation).values(c)
  for (const c of chunk(shippingLabels, 100)) await db.insert(schema.shippingLabel).values(c)
  for (const c of chunk(reviews, 100)) await db.insert(schema.review).values(c)
  for (const c of chunk(disputes, 10)) await db.insert(schema.dispute).values(c)
  for (const c of chunk(disputeMessages, 50)) await db.insert(schema.disputeMessage).values(c)

  console.log(`  ${platformOrders.length} platform orders`)
  console.log(`  ${shopOrders.length} shop orders`)
  console.log(`  ${orderItems.length} order items`)
  console.log(`  ${inventoryReservations.length} reservations`)
  console.log(`  ${shippingLabels.length} shipping labels`)
  console.log(`  ${reviews.length} reviews`)
  console.log(`  ${disputes.length} disputes, ${disputeMessages.length} messages`)
}

// =============================================================================
// Payouts
// =============================================================================
async function seedPayouts(shops: (typeof schema.shop.$inferInsert)[]) {
  console.log('Seeding payouts...')
  const payouts: (typeof schema.payout.$inferInsert)[] = []

  for (const shop of shops) {
    const count = faker.number.int({ min: 0, max: 4 })
    for (let i = 0; i < count; i++) {
      const status = faker.helpers.arrayElement(schema.payoutStatusEnum.enumValues)
      payouts.push({
        id: crypto.randomUUID(),
        shopId: shop.id!,
        amountCents: faker.number.int({ min: 5000, max: 750000 }),
        status,
        sentAt: status === 'sent' ? faker.date.past({ years: 1 }) : undefined,
        createdAt: faker.date.past({ years: 1 }),
      })
    }
  }

  if (payouts.length > 0) {
    for (const c of chunk(payouts, 100)) {
      await db.insert(schema.payout).values(c)
    }
  }

  console.log(`  ${payouts.length} payouts`)
}

// =============================================================================
// Notifications
// =============================================================================
async function seedNotifications(users: (typeof schema.user.$inferInsert)[]) {
  console.log('Seeding notifications...')
  const types = [
    'order_placed',
    'order_shipped',
    'order_delivered',
    'review_received',
    'payout_sent',
    'product_low_stock',
    'dispute_opened',
    'shop_suspended',
    'welcome',
    'message_received',
  ]

  const notifications: (typeof schema.notification.$inferInsert)[] = []

  for (const user of users) {
    const count = faker.number.int({ min: 0, max: 10 })
    for (let i = 0; i < count; i++) {
      notifications.push({
        id: crypto.randomUUID(),
        userId: user.id!,
        type: faker.helpers.arrayElement(types),
        data: {
          title: faker.lorem.sentence(4),
          body: faker.lorem.sentence(10),
          actionUrl: faker.helpers.maybe(() => `/orders/${faker.string.alphanumeric(8)}`, {
            probability: 0.3,
          }),
        },
        readAt: faker.datatype.boolean(0.55) ? faker.date.recent({ days: 30 }) : undefined,
        createdAt: faker.date.past({ years: 1 }),
      })
    }
  }

  if (notifications.length > 0) {
    for (const c of chunk(notifications, 200)) {
      await db.insert(schema.notification).values(c)
    }
  }

  console.log(`  ${notifications.length} notifications`)
}

// =============================================================================
// Todos
// =============================================================================
async function seedTodos() {
  console.log('Seeding todos...')
  const titles = [
    'Set up artisan profile page',
    'Configure GDPR-compliant cookie banner',
    'Design product listing card component',
    'Implement Euro pricing formatter',
    'Set up Sentry error tracking',
    'Create shipping label PDF generator',
    'Integrate Mollie payment webhooks',
    'Build admin moderation dashboard',
    'Add inventory reservation cleanup job',
    'Write dispute resolution workflow',
    'Localise checkout flow for DE / FR / NL',
    'Optimise product image lazy loading',
  ]

  await db.insert(schema.todos).values(titles.slice(0, CONFIG.todos).map((title) => ({ title })))
  console.log(`  ${CONFIG.todos} todos`)
}

// =============================================================================
// Main
// =============================================================================
async function seed() {
  const shouldClear = process.argv.includes('--clear')

  if (shouldClear) {
    await clearAll()
  }

  const users = await seedUsers()
  const shops = await seedShops(users)
  const categories = await seedCategories()
  const products = await seedProducts(shops, categories)
  await seedCarts(users, products)
  await seedOrders(users, shops, products)
  await seedPayouts(shops)
  await seedNotifications(users)
  await seedTodos()

  console.log('\nSeed completed successfully!')
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
