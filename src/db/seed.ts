// biome-ignore-all lint/style/noNonNullAssertion: seed script guarantees database IDs and optional fields are generated before reference
import { randomBytes, scryptSync, createHash } from 'node:crypto'
import { rm } from 'node:fs/promises'

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

function normalizeCountryCode(country: string): string | null {
  const upper = country.trim().toUpperCase()
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper
  }
  const mapping: Record<string, string> = {
    belgium: 'BE',
    france: 'FR',
    germany: 'DE',
    italy: 'IT',
    netherlands: 'NL',
    spain: 'ES',
    portugal: 'PT',
    estonia: 'EE',
  }
  return mapping[country.trim().toLowerCase()] || 'FR'
}
import { join } from 'node:path'
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
import {
  clearProductsIndex,
  configureProductsIndex,
  populateProductsIndex,
} from '../lib/meilisearch-products.server.ts'
import { db } from './index.ts'
import * as schema from './schema.ts'
import {
  CATEGORY_DESCRIPTIONS,
  SHOP_DESCRIPTIONS,
  SUBCATEGORY_DESCRIPTIONS,
} from './seed-descriptions.ts'
import { generateOrderNumber } from '../lib/order-numbers.ts'

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
}

/** Generate a unique scrypt password hash compatible with Better Auth. */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const key = scryptSync(password, salt, 64, {
    N: 16384,
    r: 16,
    p: 1,
    maxmem: 128 * 16384 * 16 * 2,
  })
  return `${salt}:${key.toString('hex')}`
}

const PRODUCTS_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'products')
const SHOPS_UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'shops')

const SHIPPED_STATUSES = new Set(['shipped', 'delivered', 'completed', 'disputed'])
const DELIVERED_STATUSES = new Set(['delivered', 'completed'])
const LABEL_STATUSES = new Set(['shipped', 'delivered', 'completed'])

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
    street: locale.location.streetAddress({ useFullAddress: true }),
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
    'product_variant_option',
    'product_option_value',
    'product_option',
    'product_variant',
    'product',
    'notification',
    'payout',
    'payout_reconciliation_log',
    'shop_socials',
    'shop',
    'category',
    'session',
    'account',
    'verification',
    'two_factor',
    'user',
    'rate_limit',
    'invoices',
    'invoice_number_sequence',
    'audit_log',
    'customer_note',
    'customer_tag',
    'owner_message',
    'owner_message_thread',
    'financial_total_audit',
    'meilisearch_sync_queue',
    'sendcloud_webhook_event',
    'brevo_webhook_event',
    'email_outbox',
    'email_send_log',
    'email_suppression',
    'user_email_preference',
  ]
  for (const table of tables) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`))
  }
  await rm(PRODUCTS_UPLOAD_DIR, { recursive: true, force: true })
  await rm(SHOPS_UPLOAD_DIR, { recursive: true, force: true })
  await clearProductsIndex()
  console.log('All tables cleared.')
}

// =============================================================================
// Users & Accounts
// =============================================================================
async function seedUsers() {
  console.log('Seeding users...')

  // Check which emails already exist so we skip them (and their accounts)
  const existingRows = await db.select({ email: schema.user.email }).from(schema.user)
  const existingEmails = new Set(existingRows.map((r) => r.email))

  const users: (typeof schema.user.$inferInsert)[] = []
  const accounts: (typeof schema.account.$inferInsert)[] = []

  // Known test accounts
  const known = [
    { name: 'Admin User', email: 'admin@eurtisan.local', role: 'admin' as const },
    {
      name: 'Admin User 2FA',
      email: 'admin.2fa@eurtisan.local',
      role: 'admin' as const,
      twoFactorEnabled: true,
    },
    { name: 'Eurtisan Creator', email: 'creator@eurtisan.local', role: 'creator' as const },
    {
      name: 'Eurtisan Creator 2FA',
      email: 'creator.2fa@eurtisan.local',
      role: 'creator' as const,
      twoFactorEnabled: true,
    },
    { name: 'Customer User', email: 'customer@eurtisan.local', role: 'customer' as const },
  ]

  const twoFactorEntries: (typeof schema.twoFactor.$inferInsert)[] = []

  for (const k of known) {
    if (existingEmails.has(k.email)) continue
    const id = crypto.randomUUID()
    users.push({
      id,
      name: k.name,
      email: k.email,
      emailVerified: true,
      role: k.role,
      image: avatarUrl(k.email),
      twoFactorEnabled: k.twoFactorEnabled ?? false,
    })
    const password = k.email.split('@')[0]
    accounts.push({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: hashPassword(password),
    })

    if (k.twoFactorEnabled) {
      twoFactorEntries.push({
        id: crypto.randomUUID(),
        userId: id,
        secret: 'MJSXE62TPNUGK4Z2', // base32 secret
        backupCodes: JSON.stringify(['1234-5678', '8765-4321', '1111-2222', '3333-4444']),
        verified: true,
      })
    }
    console.log(`  Credentials: ${k.email} / ${password}`)
  }

  // Random admins
  for (let i = 0; i < CONFIG.admins; i++) {
    const locale = randomLocale()
    const email = `admin.${i + 1}@eurtisan.local`
    if (existingEmails.has(email)) continue
    users.push({
      id: crypto.randomUUID(),
      name: `${locale.person.firstName()} ${locale.person.lastName()}`,
      email,
      emailVerified: true,
      role: 'admin',
      image: avatarUrl(email),
      twoFactorEnabled: false,
    })
  }

  // Random creators
  for (let i = 0; i < CONFIG.creators; i++) {
    const locale = randomLocale()
    const email = `creator.${i + 1}@eurtisan.local`
    if (existingEmails.has(email)) continue
    const id = crypto.randomUUID()
    users.push({
      id,
      name: `${locale.person.firstName()} ${locale.person.lastName()}`,
      email,
      emailVerified: true,
      role: 'creator',
      image: avatarUrl(email),
      twoFactorEnabled: false,
    })
    accounts.push({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: hashPassword(randomBytes(32).toString('hex')),
    })
  }

  // Random customers
  for (let i = 0; i < CONFIG.customers; i++) {
    const locale = randomLocale()
    const email = `customer.${i + 1}@eurtisan.local`
    if (existingEmails.has(email)) continue
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
        password: hashPassword(randomBytes(32).toString('hex')),
      })
    }
  }

  if (users.length > 0) {
    await db.insert(schema.user).values(users)
  }
  if (accounts.length > 0) {
    await db.insert(schema.account).values(accounts).onConflictDoNothing()
  }
  if (twoFactorEntries.length > 0) {
    await db.insert(schema.twoFactor).values(twoFactorEntries).onConflictDoNothing()
    console.log('  Seeded 2FA configuration for creator.2fa@eurtisan.local:')
    console.log('    Secret: MJSXE62TPNUGK4Z2')
    console.log('    Backup Codes: 1234-5678, 8765-4321, 1111-2222, 3333-4444')
  }

  console.log(`  ${users.length} new users, ${accounts.length} new accounts`)

  // Return full user list (existing + new) so downstream seeders can reference them
  return db.select().from(schema.user)
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

      const status = faker.helpers.arrayElement([
        'active',
        'active',
        'active',
        'draft',
        'pending_review',
        'paused',
      ]) as (typeof schema.shopStatusEnum.enumValues)[number]
      const paymentConnected = ['active', 'paused'].includes(status)
      const isVatRegistered = paymentConnected && faker.datatype.boolean(0.5)
      const vatId = isVatRegistered
        ? `${normalizeCountryCode(locale.location.country()) || 'FR'}${faker.string.numeric(11)}`
        : undefined

      const businessAddress = paymentConnected
        ? {
            street: locale.location.streetAddress(),
            city: locale.location.city(),
            postalCode: locale.location.zipCode(),
            country: locale.location.country(),
          }
        : undefined

      const legalEntityType = paymentConnected
        ? faker.helpers.arrayElement(['individual', 'business'])
        : undefined
      const dateOfBirth = paymentConnected ? '1980-01-01' : undefined
      const taxId = paymentConnected ? faker.string.numeric(10) : undefined
      const businessRegistrationNumber =
        paymentConnected && legalEntityType === 'business' ? faker.string.numeric(14) : undefined

      shops.push({
        id: crypto.randomUUID(),
        ownerId: creator.id!,
        name,
        slug,
        description: faker.helpers.arrayElement(SHOP_DESCRIPTIONS),
        image: shopImageUrl(slug),
        shippingOrigin: {
          street: locale.location.streetAddress(),
          city: locale.location.city(),
          postalCode: locale.location.zipCode(),
          country: locale.location.country(),
        },
        isSuspended: faker.datatype.boolean(0.03),
        status,
        onboardingStep: status === 'draft' ? 3 : 8,
        paymentConnected,
        mollieAccountId: paymentConnected ? `acct_${faker.string.alphanumeric(8)}` : undefined,
        isVatRegistered,
        vatId,
        businessAddress,
        legalEntityType,
        dateOfBirth,
        taxId,
        businessRegistrationNumber,
      })
    }
  }

  // Ensure known creator has at least one active shop
  const knownCreator = creators.find((u) => u.email === 'creator@eurtisan.local')
  const knownAdmin = users.find((u) => u.email === 'admin@eurtisan.local')

  if (knownCreator && !shops.some((s) => s.ownerId === knownCreator.id && s.status === 'active')) {
    const slug = uniqueSlug('The Forge', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'The Forge',
      slug,
      description: 'Handcrafted goods from the heart of Europe.',
      image: shopImageUrl('the-forge'),
      shippingOrigin: {
        street: 'Rue Royale 1',
        city: 'Brussels',
        postalCode: '1000',
        country: 'Belgium',
      },
      isSuspended: false,
      status: 'active',
      onboardingStep: 8,
      paymentConnected: true,
      mollieAccountId: 'acct_forge123',
      isVatRegistered: true,
      vatId: 'BE0123456789',
      legalEntityType: 'business',
      dateOfBirth: '1980-01-01',
      taxId: '1234567890',
      businessRegistrationNumber: '0123456789',
      businessAddress: {
        street: 'Rue Royale 1',
        city: 'Brussels',
        postalCode: '1000',
        country: 'Belgium',
      },
    })
  }

  // Demo shops in different onboarding / moderation statuses for the known creator
  if (knownCreator) {
    // 1. Draft — mid-onboarding (step 3, identity + story filled)
    const draftSlug = uniqueSlug('Ceramic Dreams', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'Ceramic Dreams',
      slug: draftSlug,
      tagline: 'Hand-thrown pottery from Portugal',
      description:
        'Each piece is shaped on the wheel and fired in a wood-burning kiln. We use local Portuguese clay and natural glazes.',
      category: 'home_living',
      productionType: 'handmade',
      tags: ['pottery', 'ceramics', 'handmade', 'portugal'],
      languages: ['en', 'pt'],
      image: shopImageUrl(draftSlug),
      bannerImage: shopImageUrl(`${draftSlug}-banner`),
      shippingOrigin: {
        city: 'Lisbon',
        country: 'PT',
        postalCode: '1000-001',
        processingTimeDays: { min: 3, max: 7 },
        shipsInternational: true,
      },
      currency: 'EUR',
      status: 'draft',
      onboardingStep: 3,
      hasProductionPartner: false,
      isSuspended: false,
      resubmissionCount: 0,
      paymentConnected: false,
    })

    // 2. Pending Review — completed onboarding, submitted for admin review
    const pendingSlug = uniqueSlug('Nordic Knits', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'Nordic Knits',
      slug: pendingSlug,
      tagline: 'Sustainable wool accessories from the Baltic',
      description:
        'We knit every scarf, hat, and mitten using ethically sourced wool from Estonian farms. Traditional patterns meet modern colours.',
      category: 'clothing',
      productionType: 'handmade',
      tags: ['knitwear', 'wool', 'sustainable', 'baltic', 'accessories'],
      languages: ['en', 'et'],
      image: shopImageUrl(pendingSlug),
      bannerImage: shopImageUrl(`${pendingSlug}-banner`),
      shippingOrigin: {
        city: 'Tallinn',
        country: 'EE',
        postalCode: '10111',
        processingTimeDays: { min: 5, max: 10 },
        shipsInternational: true,
      },
      currency: 'EUR',
      policies: {
        returns: { accepted: true, windowDays: 14, conditions: 'Items must be unworn with tags.' },
        exchanges: { accepted: true, conditions: 'Size exchanges within 30 days.' },
        customOrders: { accepted: true, details: 'Custom colours available on request.' },
        paymentMethods: ['card', 'ideal'],
        additionalInfo: 'All items are hand-wash only.',
      },
      status: 'pending_review',
      onboardingStep: 8,
      submittedAt: faker.date.recent({ days: 3 }),
      hasProductionPartner: false,
      isSuspended: false,
      resubmissionCount: 0,
      paymentConnected: false,
    })

    // 3. Approved — admin approved, waiting for Mollie Connect
    const approvedSlug = uniqueSlug('Rustic Woodworks', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'Rustic Woodworks',
      slug: approvedSlug,
      tagline: 'Reclaimed timber furniture and décor',
      description:
        'We give old barn wood a second life. Every table, shelf, and bowl carries the history of the forest it came from.',
      category: 'home_living',
      productionType: 'handmade',
      tags: ['woodwork', 'reclaimed', 'furniture', 'sustainable'],
      languages: ['en', 'de'],
      image: shopImageUrl(approvedSlug),
      bannerImage: shopImageUrl(`${approvedSlug}-banner`),
      shippingOrigin: {
        city: 'Munich',
        country: 'DE',
        postalCode: '80331',
        processingTimeDays: { min: 7, max: 14 },
        shipsInternational: false,
      },
      currency: 'EUR',
      policies: {
        returns: { accepted: false, conditions: 'All sales are final due to custom sizing.' },
        exchanges: { accepted: true, conditions: 'Exchange for store credit within 7 days.' },
        customOrders: { accepted: true, details: 'Bespoke dimensions available.' },
        paymentMethods: ['card', 'sofort'],
      },
      status: 'approved',
      onboardingStep: 8,
      submittedAt: faker.date.recent({ days: 7 }),
      reviewedAt: faker.date.recent({ days: 5 }),
      reviewedBy: knownAdmin?.id ?? knownCreator.id,
      hasProductionPartner: true,
      productionPartnerDetails: 'Local sawmill partner for reclaimed timber sourcing.',
      isSuspended: false,
      resubmissionCount: 0,
      paymentConnected: false,
    })

    // 4. Aegean Crafts — Greek Shop for testing Greek VAT ID prefix ("EL" prefix)
    const greekSlug = uniqueSlug('Aegean Crafts', shopSlugs)
    shops.push({
      id: crypto.randomUUID(),
      ownerId: knownCreator.id,
      name: 'Aegean Crafts',
      slug: greekSlug,
      tagline: 'Handmade olive wood and ceramic items from Greece',
      description: 'Bringing the sunlight of the Aegean to your home with artisanal wood carvings.',
      category: 'home_living',
      productionType: 'handmade',
      tags: ['greece', 'aegean', 'olivewood', 'ceramics'],
      languages: ['en', 'el'],
      image: shopImageUrl(greekSlug),
      bannerImage: shopImageUrl(`${greekSlug}-banner`),
      shippingOrigin: {
        street: 'Mitropoleos 12',
        city: 'Athens',
        postalCode: '10557',
        country: 'Greece',
      },
      currency: 'EUR',
      status: 'active',
      onboardingStep: 8,
      paymentConnected: true,
      mollieAccountId: 'acct_aegean123',
      isVatRegistered: true,
      vatId: 'EL999999999', // Greek VAT prefix is EL
      legalEntityType: 'business',
      dateOfBirth: '1985-06-15',
      taxId: '123456789',
      businessRegistrationNumber: '987654321',
      businessAddress: {
        street: 'Mitropoleos 12',
        city: 'Athens',
        postalCode: '10557',
        country: 'Greece',
      },
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
    await db.insert(schema.shop).values(shops).onConflictDoNothing({ target: schema.shop.slug })
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
      description: CATEGORY_DESCRIPTIONS[def.name],
    })
  }

  if (categories.length > 0) {
    await db
      .insert(schema.categories)
      .values(categories)
      .onConflictDoNothing({ target: schema.categories.slug })
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
        description: SUBCATEGORY_DESCRIPTIONS[`${def.name}-${sub}`],
        parentId,
      })
    }
  }

  if (subCategories.length > 0) {
    await db
      .insert(schema.categories)
      .values(subCategories)
      .onConflictDoNothing({ target: schema.categories.slug })
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
    // Skip non-active/non-approved shops (draft / pending_review demo shops)
    if (shop.status && !['active', 'approved'].includes(shop.status)) continue

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

      const isActive = stockCount > 0 && faker.datatype.boolean(0.88)
      const status =
        isActive && faker.datatype.boolean(0.9) ? ('published' as const) : ('draft' as const)
      const publishedAt = status === 'published' ? faker.date.past({ years: 1 }) : null

      products.push({
        id: productId,
        name,
        slug,
        description: faker.commerce.productDescription(),
        priceCents,
        stockCount,
        isActive,
        status,
        publishedAt,
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

  await Promise.all(
    chunk(products, 100).map((c) => db.insert(schema.product).values(c).onConflictDoNothing()),
  )
  await Promise.all(
    chunk(productImages, 200).map((c) =>
      db.insert(schema.productImage).values(c).onConflictDoNothing(),
    ),
  )

  // Seed variants for a subset (e.g. 25%) of successfully inserted products
  console.log('Seeding variants and options for 25% of products...')
  const variantEligibleProducts = products.filter(() => Math.random() < 0.25)
  for (const p of variantEligibleProducts) {
    try {
      await seedProductVariants(p.id!, p.slug!, p.name!)
    } catch (err) {
      console.error(`Failed to seed variants for product ${p.id}:`, err)
    }
  }

  console.log(`  ${products.length} products, ${productImages.length} images`)
  return products
}

async function seedProductVariants(productId: string, baseSlug: string, _productName: string) {
  const sizeOptionId = crypto.randomUUID()
  const colorOptionId = crypto.randomUUID()

  await db.insert(schema.productOption).values([
    {
      id: sizeOptionId,
      productId,
      name: 'Size',
      displayOrder: 0,
    },
    {
      id: colorOptionId,
      productId,
      name: 'Color',
      displayOrder: 1,
    },
  ])

  const sizes = ['S', 'M', 'L']
  const colors = ['Off-White', 'Indigo', 'Charcoal']

  const sizeValues = sizes.map((val, idx) => ({
    id: crypto.randomUUID(),
    optionId: sizeOptionId,
    value: val,
    displayOrder: idx,
  }))

  const colorValues = colors.map((val, idx) => ({
    id: crypto.randomUUID(),
    optionId: colorOptionId,
    value: val,
    displayOrder: idx,
  }))

  await db.insert(schema.productOptionValue).values([...sizeValues, ...colorValues])

  const variants: (typeof schema.productVariant.$inferInsert)[] = []
  const variantOptions: (typeof schema.productVariantOption.$inferInsert)[] = []

  for (const sVal of sizeValues) {
    for (const cVal of colorValues) {
      const variantId = crypto.randomUUID()
      const variantName = `${sVal.value} / ${cVal.value}`
      const variantSku = `${baseSlug}-${sVal.value.toLowerCase()}-${cVal.value.toLowerCase().replace(/\s+/g, '-')}`
      const priceAdjustment = sVal.value === 'L' ? 500 : 0 // Large costs 5€ extra
      const stockCount = faker.number.int({ min: 5, max: 40 })

      variants.push({
        id: variantId,
        productId,
        sku: variantSku,
        name: variantName,
        priceAdjustmentCents: priceAdjustment,
        stockCount,
        isActive: true,
      })

      variantOptions.push(
        { variantId, optionValueId: sVal.id },
        { variantId, optionValueId: cVal.id },
      )
    }
  }

  await db.insert(schema.productVariant).values(variants)
  await db.insert(schema.productVariantOption).values(variantOptions)
}

// =============================================================================
// Carts
// =============================================================================
async function seedCarts(
  users: (typeof schema.user.$inferInsert)[],
  products: (typeof schema.product.$inferInsert)[],
) {
  console.log('Seeding carts...')
  const testEmails = new Set([
    'admin@eurtisan.local',
    'creator@eurtisan.local',
    'customer@eurtisan.local',
  ])
  const customers = users.filter((u) => u.role === 'customer' && !testEmails.has(u.email))
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

  if (carts.length > 0) await db.insert(schema.cart).values(carts).onConflictDoNothing()
  if (cartItems.length > 0) await db.insert(schema.cartItem).values(cartItems).onConflictDoNothing()

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

  const shopById = new Map(shops.map((s) => [s.id, s]))

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
      orderNumber: generateOrderNumber(),
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
        trackingNumber: SHIPPED_STATUSES.has(shopStatus)
          ? faker.string.alphanumeric(12).toUpperCase()
          : undefined,
        trackingUrl: SHIPPED_STATUSES.has(shopStatus)
          ? `https://track.eurtisan.eu/${faker.string.alphanumeric(8)}`
          : undefined,
        deliveredAt: DELIVERED_STATUSES.has(shopStatus)
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
        const unitPriceCents = p.priceCents ?? 0
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
      if (LABEL_STATUSES.has(shopStatus)) {
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
      if (DELIVERED_STATUSES.has(shopStatus) && Math.random() < CONFIG.reviewsRate) {
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
        const ownerId = shopById.get(entry.shopId)?.ownerId ?? customer.id!
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

  // Sequential: platformOrder must exist before shopOrder (FK dependency),
  // and shopOrder must exist before orderItem/inventoryReservation/shippingLabel.
  await Promise.all(
    chunk(platformOrders, 100).map((c) =>
      db.insert(schema.platformOrder).values(c).onConflictDoNothing(),
    ),
  )
  await Promise.all(
    chunk(shopOrders, 100).map((c) => db.insert(schema.shopOrder).values(c).onConflictDoNothing()),
  )
  // The following tables only FK to shopOrder / platformOrder and are independent of each other.
  await Promise.all([
    ...chunk(orderItems, 200).map((c) =>
      db.insert(schema.orderItem).values(c).onConflictDoNothing(),
    ),
    ...chunk(inventoryReservations, 100).map((c) =>
      db.insert(schema.inventoryReservation).values(c).onConflictDoNothing(),
    ),
    ...chunk(shippingLabels, 100).map((c) =>
      db.insert(schema.shippingLabel).values(c).onConflictDoNothing(),
    ),
    ...chunk(reviews, 100).map((c) => db.insert(schema.review).values(c).onConflictDoNothing()),
    ...chunk(disputes, 10).map((c) => db.insert(schema.dispute).values(c).onConflictDoNothing()),
  ])
  // disputeMessages FK to disputes, so they must run after the disputes insert.
  await Promise.all(
    chunk(disputeMessages, 50).map((c) =>
      db.insert(schema.disputeMessage).values(c).onConflictDoNothing(),
    ),
  )

  console.log('Generating invoices for paid/completed orders...')
  const invoiceEligibleOrders = platformOrders.filter(
    (o) =>
      o.status &&
      ['paid', 'processing', 'shipped', 'delivered', 'completed', 'disputed', 'refunded'].includes(
        o.status,
      ),
  )

  const { createInvoicesForPlatformOrder } = await import('../lib/invoices.server.ts')
  for (const order of invoiceEligibleOrders) {
    try {
      await createInvoicesForPlatformOrder(order.id!)
    } catch (err) {
      console.error(`Failed to generate invoices for order ${order.id}:`, err)
    }
  }

  console.log(`  ${platformOrders.length} platform orders`)
  console.log(`  ${shopOrders.length} shop orders`)
  console.log(`  ${orderItems.length} order items`)
  console.log(`  ${inventoryReservations.length} reservations`)
  console.log(`  ${shippingLabels.length} shipping labels`)
  console.log(`  ${reviews.length} reviews`)
  console.log(`  ${disputes.length} disputes, ${disputeMessages.length} messages`)
  console.log(`  Generated invoices for ${invoiceEligibleOrders.length} platform orders`)

  return shopOrders
}

// =============================================================================
// Payouts
// =============================================================================
async function seedPayouts(shopOrders: (typeof schema.shopOrder.$inferInsert)[]) {
  console.log('Seeding payouts...')
  const payouts: (typeof schema.payout.$inferInsert)[] = []

  for (const shopOrder of shopOrders) {
    const count = faker.number.int({ min: 0, max: 1 })
    for (let i = 0; i < count; i++) {
      const status = faker.helpers.arrayElement(schema.payoutStatusEnum.enumValues)
      payouts.push({
        id: crypto.randomUUID(),
        shopId: shopOrder.shopId!,
        shopOrderId: shopOrder.id!,
        amountCents: faker.number.int({ min: 5000, max: 750000 }),
        status,
        sentAt: status === 'sent' ? faker.date.past({ years: 1 }) : undefined,
        createdAt: faker.date.past({ years: 1 }),
      })
    }
  }

  if (payouts.length > 0) {
    await Promise.all(
      chunk(payouts, 100).map((c) => db.insert(schema.payout).values(c).onConflictDoNothing()),
    )
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
    await Promise.all(
      chunk(notifications, 200).map((c) =>
        db.insert(schema.notification).values(c).onConflictDoNothing(),
      ),
    )
  }

  console.log(`  ${notifications.length} notifications`)
}

async function seedCustomerManagement(
  shops: (typeof schema.shop.$inferInsert)[],
  users: (typeof schema.user.$inferInsert)[],
) {
  console.log('Seeding customer notes, tags, and messages...')
  const customers = users.filter((u) => u.role === 'customer')
  const notes: (typeof schema.customerNote.$inferInsert)[] = []
  const tags: (typeof schema.customerTag.$inferInsert)[] = []
  const threads: (typeof schema.ownerMessageThread.$inferInsert)[] = []
  const messages: (typeof schema.ownerMessage.$inferInsert)[] = []

  for (const shop of shops) {
    if (shop.status && !['active', 'approved'].includes(shop.status)) continue

    const shopCustomers = faker.helpers.arrayElements(customers, { min: 2, max: 4 })
    for (const customer of shopCustomers) {
      const emailHash = hashEmail(customer.email!)

      tags.push({
        id: crypto.randomUUID(),
        shopId: shop.id!,
        customerEmailHash: emailHash,
        tag: faker.helpers.arrayElement([
          'VIP',
          'Frequent Buyer',
          'Custom Order',
          'Friendly',
          'Returned Item',
        ]),
      })

      notes.push({
        id: crypto.randomUUID(),
        shopId: shop.id!,
        customerEmailHash: emailHash,
        content: faker.helpers.arrayElement([
          'Prefers express shipping.',
          'Requested custom engraving on the next order.',
          'Very responsive and polite.',
          'Inquired about international shipping rates to Switzerland.',
          'Prefers eco-friendly packaging if possible.',
        ]),
        createdBy: shop.ownerId,
      })

      const threadId = crypto.randomUUID()
      threads.push({
        id: threadId,
        shopId: shop.id!,
        customerUserId: customer.id!,
        customerEmailHash: emailHash,
        subject: faker.helpers.arrayElement([
          'Question about sizing',
          'Custom order inquiry',
          'Shipping time estimate',
          'Wholesale request',
          'Return request',
        ]),
      })

      const msgCount = faker.number.int({ min: 2, max: 5 })
      for (let m = 0; m < msgCount; m++) {
        messages.push({
          id: crypto.randomUUID(),
          threadId,
          senderRole: m % 2 === 0 ? 'buyer' : 'owner',
          body: faker.lorem.sentences(faker.number.int({ min: 1, max: 3 })),
          createdAt: faker.date.recent({ days: 10 }),
        })
      }
    }
  }

  if (tags.length > 0) {
    await db.insert(schema.customerTag).values(tags).onConflictDoNothing()
  }
  if (notes.length > 0) {
    await db.insert(schema.customerNote).values(notes).onConflictDoNothing()
  }
  if (threads.length > 0) {
    await db.insert(schema.ownerMessageThread).values(threads).onConflictDoNothing()
  }
  if (messages.length > 0) {
    await db.insert(schema.ownerMessage).values(messages).onConflictDoNothing()
  }

  console.log(
    `  Seeded ${tags.length} tags, ${notes.length} notes, ${threads.length} message threads`,
  )
}

// =============================================================================
// Main
// =============================================================================
async function seed() {
  const shouldClear = process.argv.includes('--clear')
  const shouldForce = process.argv.includes('--force')

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeding is disabled in production')
  }

  if (process.env.NODE_ENV === 'production' && shouldClear) {
    throw new Error('Clearing data is disabled in production')
  }

  if (shouldClear && !shouldForce) {
    throw new Error('Use --force to confirm clearing data')
  }

  if (shouldClear) {
    await clearAll()
  }

  const users = await seedUsers()
  const [shops, categories] = await Promise.all([seedShops(users), seedCategories()])
  const products = await seedProducts(shops, categories)
  await seedCarts(users, products)
  const shopOrders = await seedOrders(users, shops, products)
  await seedPayouts(shopOrders)
  await seedNotifications(users)
  await seedCustomerManagement(shops, users)

  console.log('\nConfiguring Meilisearch index...')
  await configureProductsIndex()
  console.log('Populating Meilisearch index...')
  const { synced, errors } = await populateProductsIndex()
  console.log(`Meilisearch: synced ${synced} products, ${errors} errors`)

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
