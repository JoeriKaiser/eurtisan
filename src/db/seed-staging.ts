/**
 * Staging / Production Seed — Idempotent Base Data
 *
 * Run once after initial deployment to populate the database with permanent,
 * curated demo data. Safe to re-run: uses ON CONFLICT DO NOTHING and
 * pre-queries existing records so duplicate runs are no-ops.
 *
 * Usage:
 *   bun run src/db/seed-staging.ts
 *
 * Or via Makefile:
 *   make staging-seed
 */

import { randomBytes, scryptSync } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { pool } from '../db.ts'
import { db } from './index.ts'
import {
  configureProductsIndex,
  populateProductsIndex,
} from '../lib/meilisearch-products.server.ts'
import { encryptJsonb } from '../lib/encryption.server.ts'
import { uploadImageFromUrl } from '../lib/image-storage.server.ts'
import * as schema from './schema.ts'
import { CATEGORY_DESCRIPTIONS, SUBCATEGORY_DESCRIPTIONS } from './seed-descriptions.ts'

let orderNumberCounter = 0
function nextStagingOrderNumber(): string {
  orderNumberCounter += 1
  return `EUR-${String(orderNumberCounter).padStart(6, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Configuration
// ═══════════════════════════════════════════════════════════════════════════

/** Fixed-state pseudo-random generator keeps curated staging data deterministic. */
let randomState = 42
function random(): number {
  randomState = (randomState + 0x6d2b79f5) | 0
  let value = randomState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
}

function randomInteger(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function randomAlphanumeric(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length }, () => alphabet[randomInteger(0, alphabet.length - 1)]).join('')
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

// ═══════════════════════════════════════════════════════════════════════════
// 2. Utilities
// ═══════════════════════════════════════════════════════════════════════════

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
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

const IMAGE_UPLOAD_CONCURRENCY = 8

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0
  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return results
}

function pick<T>(arr: T[]): T {
  return arr[randomInteger(0, arr.length - 1)]
}

const COUNTRY_CODES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'CH',
  'NO',
  'IS',
  'LI',
  'GB',
]

const REVIEW_COMMENTS = [
  'Beautiful craftsmanship and fast shipping.',
  'Even better than the photos. Highly recommend this maker.',
  'Lovely quality, exactly as described.',
  'A thoughtful purchase — the seller was very helpful.',
  'Well made and arrived in perfect condition.',
  'Unique piece, great attention to detail.',
  'So happy with this order. Will buy again.',
  'Gorgeous handmade work, worth every cent.',
  'The packaging was lovely and the item is stunning.',
  'Exactly what I was looking for. Five stars.',
  'Exceeds expectations. Real artisan quality.',
  'Prompt delivery and a beautiful product.',
  'You can feel the care that went into making this.',
  'Wonderful addition to my home. Thank you.',
  'Fantastic service and an exceptional product.',
]

const STAGING_CITIES = ['Amsterdam', 'Antwerp', 'Berlin', 'Lille', 'Lisbon', 'Milan', 'Prague']
let addressCounter = 0
function makeAddress(): Record<string, unknown> {
  addressCounter += 1
  return {
    name: `Staging Customer ${String(addressCounter).padStart(3, '0')}`,
    line1: `${randomInteger(1, 240)} Artisan Street`,
    line2: random() < 0.3 ? `Studio ${randomInteger(1, 20)}` : undefined,
    city: pick(STAGING_CITIES),
    postalCode: String(randomInteger(10_000, 99_999)),
    country: pick(COUNTRY_CODES),
  }
}

/** Safe date relative to now (always in the past, minimum 1 day). */
function daysAgo(days: number): Date {
  const elapsedDays = 1 + random() * Math.max(days - 1, 0)
  return new Date(Date.now() - elapsedDays * 24 * 60 * 60 * 1000)
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Users (idempotent via email pre-check)
// ═══════════════════════════════════════════════════════════════════════════

const KNOWN_USERS = [
  { name: 'Admin User', email: 'admin@eurtisan.local', role: 'admin' as const, hasPassword: true },
  {
    name: 'Eurtisan Creator',
    email: 'creator@eurtisan.local',
    role: 'creator' as const,
    hasPassword: true,
  },
  {
    name: 'Customer User',
    email: 'customer@eurtisan.local',
    role: 'customer' as const,
    hasPassword: false,
  },
  {
    name: 'Moderator User',
    email: 'moderator@eurtisan.local',
    role: 'admin' as const,
    hasPassword: true,
  },
  {
    name: 'Second Creator',
    email: 'creator2@eurtisan.local',
    role: 'creator' as const,
    hasPassword: true,
  },
]

async function seedUsers(): Promise<(typeof schema.user.$inferSelect)[]> {
  console.log('Seeding staging users…')

  const existing = await db.select({ email: schema.user.email }).from(schema.user)
  const existingEmails = new Set(existing.map((r) => r.email))

  const users: (typeof schema.user.$inferInsert)[] = []
  const accounts: (typeof schema.account.$inferInsert)[] = []

  for (const u of KNOWN_USERS) {
    if (existingEmails.has(u.email)) continue
    const id = crypto.randomUUID()
    users.push({
      id,
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      image: avatarUrl(u.email),
    })
    if (u.hasPassword) {
      const password = u.email.split('@')[0]
      accounts.push({
        id: crypto.randomUUID(),
        accountId: id,
        providerId: 'credential',
        userId: id,
        password: hashPassword(password),
      })
      console.log(`  Credentials: ${u.email} / ${password}`)
    }
  }

  if (users.length > 0) {
    await db.insert(schema.user).values(users)
    console.log(`  → ${users.length} new users`)
  }
  if (accounts.length > 0) {
    await db.insert(schema.account).values(accounts).onConflictDoNothing()
    console.log(`  → ${accounts.length} new credential accounts`)
  }

  // Return full user set (existing + new) for downstream references
  return db.select().from(schema.user)
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Categories (idempotent via slug conflict)
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORY_DEFS = [
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

async function seedCategories(): Promise<(typeof schema.categories.$inferSelect)[]> {
  console.log('Seeding staging categories…')

  // Pre-fetch existing categories; on re-run these will be used as-is
  const existing = await db.select().from(schema.categories)
  const existingBySlug = new Map(existing.map((c) => [c.slug, c]))

  const cats: (typeof schema.categories.$inferInsert)[] = []
  // Map from logical name → actual DB id (existing or new)
  const categoryIds = new Map<string, string>()
  let newCats = 0
  let skippedCats = 0

  // Register existing categories by name for subcategory parentId references
  const categoryDefBySlug = new Map(CATEGORY_DEFS.map((d) => [slugify(d.name), d]))
  for (const c of existing) {
    // Only parent categories (parentId is null)
    if (c.parentId === null) {
      // Map by name for the known category definitions
      const def = categoryDefBySlug.get(c.slug)
      if (def) categoryIds.set(def.name, c.id)
    }
  }

  for (const def of CATEGORY_DEFS) {
    const slug = slugify(def.name)
    const existingCat = existingBySlug.get(slug)

    if (existingCat) {
      categoryIds.set(def.name, existingCat.id)
      skippedCats++
    } else {
      const id = crypto.randomUUID()
      categoryIds.set(def.name, id)
      cats.push({ id, name: def.name, slug, description: CATEGORY_DESCRIPTIONS[def.name] })
      newCats++
    }
  }

  if (cats.length > 0) {
    await db
      .insert(schema.categories)
      .values(cats)
      .onConflictDoNothing({ target: schema.categories.slug })
  }

  // Subcategories
  const subs: (typeof schema.categories.$inferInsert)[] = []
  let newSubs = 0
  let skippedSubs = 0

  for (const def of CATEGORY_DEFS) {
    const parentId = categoryIds.get(def.name)
    if (!parentId) continue
    for (const sub of def.subs) {
      const subSlug = slugify(`${def.name}-${sub}`)
      if (existingBySlug.has(subSlug)) {
        skippedSubs++
        continue
      }
      const id = crypto.randomUUID()
      categoryIds.set(`${def.name}-${sub}`, id)
      subs.push({
        id,
        name: sub,
        slug: subSlug,
        description: SUBCATEGORY_DESCRIPTIONS[`${def.name}-${sub}`],
        parentId,
      })
      newSubs++
    }
  }

  if (subs.length > 0) {
    await db
      .insert(schema.categories)
      .values(subs)
      .onConflictDoNothing({ target: schema.categories.slug })
  }

  console.log(
    `  → ${newCats} new categories (${skippedCats} existed), ${newSubs} new subcategories (${skippedSubs} existed)`,
  )
  return db.select().from(schema.categories)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Shops (idempotent via slug conflict)
// ═══════════════════════════════════════════════════════════════════════════

interface ShopDef {
  ownerEmail: string
  name: string
  slug: string
  tagline: string
  description: string
  category: string
  productionType: string
  tags: string[]
  languages: string[]
  shippingOrigin: Record<string, unknown>
  status: (typeof schema.shopStatusEnum.enumValues)[number]
  traderStatus: (typeof schema.traderStatusEnum.enumValues)[number]
  onboardingStep: number
  policies?: Record<string, unknown>
  isSuspended?: boolean
  hasProductionPartner?: boolean
  paymentConnected?: boolean
}

const SHOP_DEFS: ShopDef[] = [
  // ── Active shop for the primary creator ──────────────────────────
  {
    ownerEmail: 'creator@eurtisan.local',
    name: 'The Forge',
    slug: 'the-forge',
    tagline: 'Handcrafted goods from the heart of Europe',
    description:
      'The Forge is a Brussels-based collective of artisans creating timeless pieces that blend traditional European craftsmanship with contemporary design. Every item is made by hand in our shared workshop, using locally sourced, sustainable materials.',
    category: 'home_living',
    productionType: 'handmade',
    tags: ['handmade', 'brussels', 'sustainable', 'ceramics', 'woodwork'],
    languages: ['en', 'fr', 'nl'],
    shippingOrigin: {
      city: 'Brussels',
      country: 'BE',
      postalCode: '1000',
      processingTimeDays: { min: 3, max: 7 },
      shipsInternational: true,
    },
    policies: {
      returns: {
        accepted: true,
        windowDays: 14,
        conditions: 'Items must be unused in original packaging.',
      },
      exchanges: { accepted: true, conditions: 'Size exchanges within 30 days.' },
      customOrders: { accepted: true, details: 'Contact us for bespoke commissions.' },
      paymentMethods: ['card', 'ideal', 'bancontact'],
    },
    status: 'active',
    onboardingStep: 8,
    paymentConnected: true,
    traderStatus: 'trader',
  },
  // ── Draft shop (mid-onboarding) ──────────────────────────────────
  {
    ownerEmail: 'creator@eurtisan.local',
    name: 'Ceramic Dreams',
    slug: 'ceramic-dreams',
    tagline: 'Hand-thrown pottery from Portugal',
    description:
      'Each piece is shaped on the wheel and fired in a wood-burning kiln. We use local Portuguese clay and natural glazes to create dinnerware and decorative pieces that bring warmth to any table.',
    category: 'home_living',
    productionType: 'handmade',
    tags: ['pottery', 'ceramics', 'handmade', 'portugal'],
    languages: ['en', 'pt'],
    shippingOrigin: {
      city: 'Lisbon',
      country: 'PT',
      postalCode: '1000-001',
      processingTimeDays: { min: 3, max: 7 },
      shipsInternational: true,
    },
    status: 'draft',
    onboardingStep: 3,
    traderStatus: 'trader',
  },
  // ── Pending review shop ──────────────────────────────────────────
  {
    ownerEmail: 'creator@eurtisan.local',
    name: 'Nordic Knits',
    slug: 'nordic-knits',
    tagline: 'Sustainable wool accessories from the Baltic',
    description:
      'We knit every scarf, hat, and mitten using ethically sourced wool from Estonian farms. Traditional patterns meet modern colours in our slow-made, small-batch collections.',
    category: 'clothing',
    productionType: 'handmade',
    tags: ['knitwear', 'wool', 'sustainable', 'baltic', 'accessories'],
    languages: ['en', 'et'],
    shippingOrigin: {
      city: 'Tallinn',
      country: 'EE',
      postalCode: '10111',
      processingTimeDays: { min: 5, max: 10 },
      shipsInternational: true,
    },
    policies: {
      returns: { accepted: true, windowDays: 14, conditions: 'Items must be unworn with tags.' },
      exchanges: { accepted: true, conditions: 'Size exchanges within 30 days.' },
      customOrders: { accepted: true, details: 'Custom colours available on request.' },
      paymentMethods: ['card', 'ideal'],
    },
    status: 'pending_review',
    onboardingStep: 8,
    traderStatus: 'trader',
  },
  // ── Approved (awaiting Mollie Connect) ───────────────────────────
  {
    ownerEmail: 'creator@eurtisan.local',
    name: 'Rustic Woodworks',
    slug: 'rustic-woodworks',
    tagline: 'Reclaimed timber furniture and décor',
    description:
      'We give old barn wood a second life. Every table, shelf, and bowl carries the history of the forest it came from. Based in Munich, we ship across Germany.',
    category: 'home_living',
    productionType: 'handmade',
    tags: ['woodwork', 'reclaimed', 'furniture', 'sustainable'],
    languages: ['en', 'de'],
    shippingOrigin: {
      city: 'Munich',
      country: 'DE',
      postalCode: '80331',
      processingTimeDays: { min: 7, max: 14 },
      shipsInternational: false,
    },
    policies: {
      returns: { accepted: false, conditions: 'All sales are final due to custom sizing.' },
      exchanges: { accepted: true, conditions: 'Exchange for store credit within 7 days.' },
      customOrders: { accepted: true, details: 'Bespoke dimensions available.' },
      paymentMethods: ['card', 'sofort'],
    },
    status: 'approved',
    onboardingStep: 8,
    traderStatus: 'trader',
    paymentConnected: false,
    hasProductionPartner: true,
  },
  // ── Active shop for the second creator ───────────────────────────
  {
    ownerEmail: 'creator2@eurtisan.local',
    name: 'Silver & Stone',
    slug: 'silver-and-stone',
    tagline: 'Artisan jewellery from the Alps',
    description:
      'Hand-forged silver and semi-precious stone jewellery inspired by Alpine landscapes. Each piece is one-of-a-kind, crafted in our Innsbruck studio with ethically sourced materials.',
    category: 'jewellery',
    productionType: 'handmade',
    tags: ['jewellery', 'silver', 'gemstones', 'alpine', 'austrian'],
    languages: ['en', 'de', 'it'],
    shippingOrigin: {
      city: 'Innsbruck',
      country: 'AT',
      postalCode: '6020',
      processingTimeDays: { min: 2, max: 5 },
      shipsInternational: true,
    },
    policies: {
      returns: {
        accepted: true,
        windowDays: 30,
        conditions: 'Earrings excluded for hygiene reasons.',
      },
      exchanges: { accepted: true, conditions: 'Resizing available within 14 days.' },
      customOrders: { accepted: true, details: 'Custom engagement rings and commissions welcome.' },
      paymentMethods: ['card', 'ideal', 'eps'],
    },
    status: 'active',
    onboardingStep: 8,
    traderStatus: 'trader',
    paymentConnected: true,
  },
  // ── Suspended shop (moderation) ──────────────────────────────────
  {
    ownerEmail: 'creator2@eurtisan.local',
    name: 'Quick Print Co',
    slug: 'quick-print-co',
    tagline: 'Fast custom prints and posters',
    description: 'We print your designs on demand. Fast turnaround, low prices.',
    category: 'paper_goods',
    productionType: 'manufactured',
    tags: ['prints', 'posters', 'custom', 'fast'],
    languages: ['en'],
    shippingOrigin: {
      city: 'Vienna',
      country: 'AT',
      postalCode: '1010',
      processingTimeDays: { min: 1, max: 3 },
      shipsInternational: false,
    },
    status: 'suspended',
    onboardingStep: 1,
    isSuspended: true,
    traderStatus: 'non_trader',
  },
]

async function seedShops(
  users: (typeof schema.user.$inferSelect)[],
): Promise<(typeof schema.shop.$inferSelect)[]> {
  console.log('Seeding staging shops…')

  const existing = await db.select({ slug: schema.shop.slug }).from(schema.shop)
  const existingSlugs = new Set(existing.map((r) => r.slug))

  const userByEmail = new Map(users.map((u) => [u.email, u]))

  // Also get the admin user for reviewedBy reference
  const adminUser = userByEmail.get('admin@eurtisan.local')

  const shops: (typeof schema.shop.$inferInsert)[] = []
  let skippedShops = 0

  for (const def of SHOP_DEFS) {
    const owner = userByEmail.get(def.ownerEmail)
    if (!owner) {
      console.log(`  ⚠ Skipping shop "${def.name}" — owner ${def.ownerEmail} not found`)
      continue
    }
    // Skip if shop slug already exists (idempotent re-run guard)
    if (existingSlugs.has(def.slug)) {
      skippedShops++
      continue
    }
    const id = crypto.randomUUID()

    const status = def.status
    const isApproved = status === 'approved' || status === 'active'

    shops.push({
      id,
      ownerId: owner.id,
      name: def.name,
      slug: def.slug,
      tagline: def.tagline,
      description: def.description,
      category: def.category,
      productionType: def.productionType,
      tags: def.tags,
      languages: def.languages,
      image: shopImageUrl(def.slug),
      bannerImage: shopImageUrl(`${def.slug}-banner`),
      shippingOrigin: def.shippingOrigin,
      currency: 'EUR',
      policies: def.policies,
      status,
      traderStatus: def.traderStatus,
      onboardingStep: def.onboardingStep,
      onboardingCompletedAt: status === 'active' ? daysAgo(30) : undefined,
      isSuspended: def.isSuspended ?? false,
      hasProductionPartner: def.hasProductionPartner ?? false,
      productionPartnerDetails: def.hasProductionPartner
        ? 'Local workshop partner for sustainable production.'
        : undefined,
      submittedAt: isApproved ? daysAgo(30) : daysAgo(3),
      reviewedAt: isApproved ? daysAgo(25) : undefined,
      reviewedBy: isApproved ? adminUser?.id : undefined,
      resubmissionCount: 0,
      paymentConnected: def.paymentConnected ?? false,
      paymentConnectedAt: def.paymentConnected ? daysAgo(20) : undefined,
    })
  }

  // Upload shop images to S3 so the database stores real S3 keys.
  if (shops.length > 0) {
    console.log('  → Uploading shop images to S3...')
    await runWithConcurrency(
      shops,
      async (shop) => {
        const image = shop.image
        const banner = shop.bannerImage
        if (!image || !banner) return

        try {
          const imageKey = `shops/${shop.id}.jpg`
          await uploadImageFromUrl(image, imageKey)
          shop.image = imageKey

          const bannerKey = `shops/${shop.id}-banner.jpg`
          await uploadImageFromUrl(banner, bannerKey)
          shop.bannerImage = bannerKey
        } catch (err) {
          console.error(
            `  Failed to upload shop images for ${shop.slug}, leaving external URLs:`,
            err,
          )
        }
      },
      IMAGE_UPLOAD_CONCURRENCY,
    )
  }

  if (shops.length > 0) {
    // Encrypted at rest on every application write path, so it is encrypted
    // here too — a plaintext staging row exercises `decryptJsonb`'s legacy
    // passthrough instead of the real decrypt, which is the branch production
    // never takes. Same reasoning as `seed.ts`.
    await db
      .insert(schema.shop)
      .values(
        shops.map((shop) => ({
          ...shop,
          shippingOrigin:
            shop.shippingOrigin === undefined ? undefined : encryptJsonb(shop.shippingOrigin),
        })),
      )
      .onConflictDoNothing({ target: schema.shop.slug })
  }
  console.log(`  → ${shops.length} new shops (${skippedShops} already existed)`)

  return db.select().from(schema.shop)
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Products (idempotent via (shopId, slug) conflict)
// ═══════════════════════════════════════════════════════════════════════════

interface ProductDef {
  shopSlug: string
  name: string
  slug: string
  description: string
  priceCents: number
  stockCount: number
  categoryName?: string
  images: string[] // seed strings for picsum
}

/** Curated products per active shop. */
const PRODUCT_DEFS: ProductDef[] = [
  // ── The Forge ────────────────────────────────────────────────────
  {
    shopSlug: 'the-forge',
    name: 'Hand-Thrown Stoneware Bowl',
    slug: 'stoneware-bowl',
    description:
      'A generously sized stoneware bowl, wheel-thrown and finished with a matte celadon glaze. Ideal for salads, pasta, or as a striking centrepiece. Each bowl is unique — slight variations in shape and glaze are part of its handmade character.',
    priceCents: 4200,
    stockCount: 12,
    categoryName: 'Pottery',
    images: ['the-forge-bowl-0', 'the-forge-bowl-1', 'the-forge-bowl-2'],
  },
  {
    shopSlug: 'the-forge',
    name: 'Minimalist Oak Cutting Board',
    slug: 'oak-cutting-board',
    description:
      'A solid French oak cutting board, hand-sanded to a silky finish and treated with food-safe mineral oil. The slim profile makes it easy to store, while the generous surface handles everything from bread to charcuterie.',
    priceCents: 5500,
    stockCount: 8,
    categoryName: 'Kitchenware',
    images: ['the-forge-board-0', 'the-forge-board-1'],
  },
  {
    shopSlug: 'the-forge',
    name: 'Linen Table Runner — Natural',
    slug: 'linen-table-runner',
    description:
      'Woven from Belgian flax linen, this table runner brings understated elegance to any dining setting. Stonewashed for a soft drape. Available in natural, charcoal, and terracotta.',
    priceCents: 3800,
    stockCount: 20,
    categoryName: 'Weaving',
    images: ['the-forge-runner-0', 'the-forge-runner-1', 'the-forge-runner-2'],
  },
  {
    shopSlug: 'the-forge',
    name: 'Speckled Ceramic Mug Set (2)',
    slug: 'speckled-mug-set',
    description:
      'A pair of wheel-thrown mugs with a warm speckled glaze over dark stoneware clay. Comfortable to hold, with a generous 350ml capacity. Microwave and dishwasher safe.',
    priceCents: 3400,
    stockCount: 24,
    categoryName: 'Pottery',
    images: ['the-forge-mugs-0', 'the-forge-mugs-1'],
  },
  {
    shopSlug: 'the-forge',
    name: 'Reclaimed Elm Coffee Table',
    slug: 'elm-coffee-table',
    description:
      "A one-of-a-kind coffee table crafted from a single slab of reclaimed English elm. Hairpin steel legs keep the focus on the wood's natural grain and history. Sealed with matte Osmo oil.",
    priceCents: 32000,
    stockCount: 1,
    categoryName: 'Furniture',
    images: ['the-forge-table-0', 'the-forge-table-1', 'the-forge-table-2', 'the-forge-table-3'],
  },
  {
    shopSlug: 'the-forge',
    name: 'Beeswax Dinner Candles (Set of 4)',
    slug: 'beeswax-candles-set',
    description:
      'Hand-dipped pure beeswax candles from a family apiary in Wallonia. They burn clean with a subtle honey scent and a warm golden glow. Each candle burns for approximately 8 hours.',
    priceCents: 1600,
    stockCount: 50,
    categoryName: 'Beeswax',
    images: ['the-forge-candles-0', 'the-forge-candles-1'],
  },

  // ── Silver & Stone ───────────────────────────────────────────────
  {
    shopSlug: 'silver-and-stone',
    name: 'Alpine Cascade Silver Earrings',
    slug: 'alpine-cascade-earrings',
    description:
      'Sterling silver drop earrings inspired by Alpine waterfalls. Each earring features a hand-hammered silver cascade with a faceted aquamarine drop that catches the light.',
    priceCents: 8900,
    stockCount: 3,
    categoryName: 'Silver',
    images: ['silver-earrings-0', 'silver-earrings-1', 'silver-earrings-2'],
  },
  {
    shopSlug: 'silver-and-stone',
    name: 'Edelweiss Pendant Necklace',
    slug: 'edelweiss-pendant',
    description:
      'A delicate sterling silver pendant in the shape of an Edelweiss bloom, set with a small moonstone at its centre. Suspended from a 45cm fine curb chain with a 5cm extender.',
    priceCents: 7200,
    stockCount: 5,
    categoryName: 'Silver',
    images: ['silver-pendant-0', 'silver-pendant-1'],
  },
  {
    shopSlug: 'silver-and-stone',
    name: 'Glacier Ring — Labradorite',
    slug: 'glacier-ring-labradorite',
    description:
      'A substantial sterling silver ring set with a labradorite cabochon that flashes blue and green like glacial ice. The band is textured to echo mountain rock faces.',
    priceCents: 13500,
    stockCount: 2,
    categoryName: 'Silver',
    images: ['silver-ring-0', 'silver-ring-1', 'silver-ring-2'],
  },
  {
    shopSlug: 'silver-and-stone',
    name: 'Mountain Ridge Bangle',
    slug: 'mountain-ridge-bangle',
    description:
      'A bold sterling silver bangle with a textured ridge pattern inspired by Alpine skylines. Fits most wrist sizes and stacks beautifully with other pieces.',
    priceCents: 11000,
    stockCount: 4,
    categoryName: 'Silver',
    images: ['silver-bangle-0', 'silver-bangle-1'],
  },
]

async function seedProducts(
  shops: (typeof schema.shop.$inferSelect)[],
  categories: (typeof schema.categories.$inferSelect)[],
): Promise<(typeof schema.product.$inferSelect)[]> {
  console.log('Seeding staging products…')

  const shopBySlug = new Map(shops.map((s) => [s.slug, s]))
  const catByName = new Map(categories.map((c) => [c.name, c]))

  // Only create products for active shops
  const activeShops = shops.filter((s) => s.status === 'active')
  const activeShopSlugs = new Set(activeShops.map((s) => s.slug))

  // Pre-fetch existing products so we can detect idempotent re-runs
  const existingProducts = await db.select().from(schema.product)
  const existingKey = new Map<string, string>()
  for (const p of existingProducts) {
    existingKey.set(`${p.shopId}::${p.slug}`, p.id)
  }

  const newProducts: (typeof schema.product.$inferInsert)[] = []
  const productImages: (typeof schema.productImage.$inferInsert)[] = []
  let skippedProducts = 0
  let newProductCount = 0

  for (const def of PRODUCT_DEFS) {
    const shop = shopBySlug.get(def.shopSlug)
    if (!shop) {
      console.log(`  ⚠ Skipping product "${def.name}" — shop "${def.shopSlug}" not found`)
      continue
    }
    if (!activeShopSlugs.has(def.shopSlug)) continue

    const key = `${shop.id}::${def.slug}`
    const existingId = existingKey.get(key)

    if (existingId) {
      // Product already exists — skip both product and image inserts
      skippedProducts++
      continue
    }

    const productId = crypto.randomUUID()
    const category = def.categoryName ? catByName.get(def.categoryName) : undefined

    newProducts.push({
      id: productId,
      name: def.name,
      slug: def.slug,
      description: def.description,
      priceCents: def.priceCents,
      stockCount: def.stockCount,
      isActive: def.stockCount > 0,
      status: 'published',
      publishedAt: new Date(),
      shopId: shop.id,
      categoryId: category?.id,
    })

    def.images.forEach((seed, i) => {
      productImages.push({
        id: crypto.randomUUID(),
        productId,
        url: productImageUrl(seed),
        altText: `${def.name} — view ${i + 1}`,
        sortOrder: i,
      })
    })

    newProductCount++
  }

  // Upload product images to S3 so product_image.url stores real S3 keys.
  if (productImages.length > 0) {
    console.log('  → Uploading product images to S3...')
    await runWithConcurrency(
      productImages,
      async (img) => {
        const key = `products/${img.productId}-${img.sortOrder}.jpg`
        try {
          await uploadImageFromUrl(img.url, key)
          img.url = key
        } catch (err) {
          console.error(`  Failed to upload product image ${img.url}, leaving external URL:`, err)
        }
      },
      IMAGE_UPLOAD_CONCURRENCY,
    )
  }

  if (newProducts.length > 0) {
    await db.insert(schema.product).values(newProducts)
  }
  await Promise.all(
    chunk(productImages, 100).map((c) =>
      c.length > 0
        ? db.insert(schema.productImage).values(c).onConflictDoNothing()
        : Promise.resolve(),
    ),
  )

  console.log(
    `  → ${newProductCount} new products (${skippedProducts} already existed), ${productImages.length} images`,
  )
  return db.select().from(schema.product)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Orders, Items, Reviews & Disputes (idempotent via onConflictDoNothing)
// ═══════════════════════════════════════════════════════════════════════════

async function seedOrders(
  users: (typeof schema.user.$inferSelect)[],
  shops: (typeof schema.shop.$inferSelect)[],
  products: (typeof schema.product.$inferSelect)[],
): Promise<void> {
  console.log('Seeding staging orders…')

  const customer = users.find((u) => u.email === 'customer@eurtisan.local')
  if (!customer) {
    console.log('  ⚠ Skipping orders — customer@eurtisan.local not found')
    return
  }

  // Idempotent: skip if customer already has orders
  const existingOrders = await db
    .select({ id: schema.platformOrder.id })
    .from(schema.platformOrder)
    .where(eq(schema.platformOrder.userId, customer.id))
    .limit(1)
  if (existingOrders.length > 0) {
    console.log('  → Orders already exist for this customer, skipping.')
    return
  }

  const shopById = new Map(shops.map((s) => [s.id, s]))
  const productsByShop = new Map<string, (typeof schema.product.$inferSelect)[]>()
  for (const p of products) {
    if (!productsByShop.has(p.shopId)) productsByShop.set(p.shopId, [])
    productsByShop.get(p.shopId)?.push(p)
  }

  // Find active shops with products
  const activeShopIds: string[] = []
  for (const s of shops) {
    if (s.status === 'active') activeShopIds.push(s.id)
  }
  const eligibleShops = activeShopIds.filter((id) => (productsByShop.get(id)?.length ?? 0) > 0)

  if (eligibleShops.length === 0) {
    console.log('  ⚠ Skipping orders — no active shops with products')
    return
  }

  const platformOrders: (typeof schema.platformOrder.$inferInsert)[] = []
  const shopOrders: (typeof schema.shopOrder.$inferInsert)[] = []
  const orderItems: (typeof schema.orderItem.$inferInsert)[] = []
  const reviews: (typeof schema.review.$inferInsert)[] = []
  const disputes: (typeof schema.dispute.$inferInsert)[] = []
  const disputeMessages: (typeof schema.disputeMessage.$inferInsert)[] = []

  const orderScenarios: Array<{
    status: (typeof schema.orderStatusEnum.enumValues)[number]
    daysAgo: number
    shopIdx: number
  }> = [
    { status: 'delivered', daysAgo: 7, shopIdx: 0 },
    { status: 'completed', daysAgo: 14, shopIdx: 0 },
    { status: 'shipped', daysAgo: 3, shopIdx: 1 % eligibleShops.length },
    { status: 'processing', daysAgo: 1, shopIdx: 0 },
    { status: 'paid', daysAgo: 1, shopIdx: Math.min(1, eligibleShops.length - 1) },
    { status: 'cancelled', daysAgo: 10, shopIdx: 0 },
    { status: 'disputed', daysAgo: 21, shopIdx: 0 },
  ]

  for (const scenario of orderScenarios) {
    const shopId = eligibleShops[scenario.shopIdx]
    if (!shopId) continue
    const shopProds = productsByShop.get(shopId) ?? []
    if (shopProds.length === 0) continue

    const platformOrderId = crypto.randomUUID()
    const shopOrderId = crypto.randomUUID()
    const orderDate = daysAgo(scenario.daysAgo)
    const shopStatus = scenario.status

    // Pick 1-3 random products
    const itemCount = randomInteger(1, Math.min(3, shopProds.length))
    const usedProds = new Set<string>()
    const items: Array<{ product: typeof schema.product.$inferSelect; qty: number }> = []

    for (let i = 0; i < itemCount; i++) {
      const p = pick(shopProds)
      if (usedProds.has(p.id)) continue
      usedProds.add(p.id)
      items.push({ product: p, qty: randomInteger(1, 3) })
    }

    const subtotalCents = items.reduce((sum, it) => {
      const priceCents = it.product.priceCents
      return sum + priceCents * it.qty
    }, 0)
    const shippingCostCents = subtotalCents > 5000 ? 0 : 599
    const totalCents = subtotalCents + shippingCostCents

    const TRACKING_STATUSES = new Set(['shipped', 'delivered', 'completed'])
    const DELIVERED_STATUSES_2 = new Set(['delivered', 'completed'])

    platformOrders.push({
      id: platformOrderId,
      orderNumber: nextStagingOrderNumber(),
      userId: customer.id,
      shippingAddress: makeAddress(),
      billingAddress: makeAddress(),
      totalCents,
      status: scenario.status,
      cancelledAt: scenario.status === 'cancelled' ? orderDate : undefined,
      cancellationReason: scenario.status === 'cancelled' ? 'Changed mind' : undefined,
      createdAt: orderDate,
      updatedAt: orderDate,
    })

    shopOrders.push({
      id: shopOrderId,
      platformOrderId,
      shopId,
      shippingMethod: 'standard',
      shippingCostCents,
      subtotalCents,
      status: shopStatus,
      trackingNumber: TRACKING_STATUSES.has(shopStatus)
        ? `TRK${randomAlphanumeric(10)}`
        : undefined,
      trackingUrl: TRACKING_STATUSES.has(shopStatus)
        ? `https://sendcloud.com/tracking?tracking_number=${randomAlphanumeric(12)}`
        : undefined,
      deliveredAt: DELIVERED_STATUSES_2.has(shopStatus) ? daysAgo(scenario.daysAgo - 2) : undefined,
      createdAt: orderDate,
      updatedAt: orderDate,
    })

    for (const it of items) {
      const priceCents = it.product.priceCents
      orderItems.push({
        id: crypto.randomUUID(),
        shopOrderId,
        productId: it.product.id,
        productName: it.product.name,
        unitPriceCents: priceCents,
        quantity: it.qty,
        totalCents: priceCents * it.qty,
        createdAt: orderDate,
      })
    }

    // Reviews for delivered/completed orders
    if (DELIVERED_STATUSES_2.has(shopStatus)) {
      for (const it of items) {
        reviews.push({
          id: crypto.randomUUID(),
          shopOrderId,
          productId: it.product.id,
          buyerUserId: customer.id,
          rating: randomInteger(3, 5),
          comment: pick(REVIEW_COMMENTS),
          createdAt: orderDate,
        })
      }
    }

    // Dispute
    if (shopStatus === 'disputed') {
      const ownerId = shopById.get(shopId)?.ownerId ?? customer.id
      const disputeId = crypto.randomUUID()
      disputes.push({
        id: disputeId,
        shopOrderId,
        buyerUserId: customer.id,
        reason: 'Item not as described',
        description:
          'The product I received differs significantly from the listing photos. The colour and texture are not what was advertised.',
        status: 'open',
        createdAt: orderDate,
        updatedAt: orderDate,
      })

      disputeMessages.push(
        {
          id: crypto.randomUUID(),
          disputeId,
          senderUserId: customer.id,
          message:
            'Hello, I received my order today and unfortunately the item does not match the description. The glaze colour is much darker than shown in the photos. I would like to request a return and refund.',
          createdAt: orderDate,
        },
        {
          id: crypto.randomUUID(),
          disputeId,
          senderUserId: ownerId,
          message:
            "Hi there, I'm sorry to hear that. Each piece is handmade so there can be slight variations in glaze colour. However, if you feel the difference is significant, I'm happy to accept a return. Could you share a photo so I can compare?",
          createdAt: daysAgo(scenario.daysAgo - 1),
        },
      )
    }
  }

  // Sequential: platformOrder must exist before shopOrder (FK dependency),
  // and shopOrder must exist before orderItem/review/dispute.
  await Promise.all(
    chunk(platformOrders, 50).map((c) =>
      db.insert(schema.platformOrder).values(c).onConflictDoNothing(),
    ),
  )
  await Promise.all(
    chunk(shopOrders, 50).map((c) => db.insert(schema.shopOrder).values(c).onConflictDoNothing()),
  )
  // The following tables only FK to shopOrder / platformOrder and are independent of each other.
  await Promise.all([
    ...chunk(orderItems, 100).map((c) =>
      db.insert(schema.orderItem).values(c).onConflictDoNothing(),
    ),
    ...chunk(reviews, 50).map((c) => db.insert(schema.review).values(c).onConflictDoNothing()),
    ...chunk(disputes, 10).map((c) => db.insert(schema.dispute).values(c).onConflictDoNothing()),
  ])
  // disputeMessages FK to disputes, so they must run after the disputes insert.
  await Promise.all(
    chunk(disputeMessages, 20).map((c) =>
      db.insert(schema.disputeMessage).values(c).onConflictDoNothing(),
    ),
  )

  console.log(
    `  → ${platformOrders.length} orders, ${orderItems.length} items, ${reviews.length} reviews, ${disputes.length} disputes`,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Main
// ═══════════════════════════════════════════════════════════════════════════

function assertSafeToRunStagingSeed(): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_STAGING_SEED !== 'true') {
    console.error(
      'Refusing to run staging seed: NODE_ENV=production. Set ALLOW_STAGING_SEED=true only when intentional.',
    )
    process.exit(1)
  }
}

async function seed(): Promise<void> {
  assertSafeToRunStagingSeed()
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Eurtisan — Staging Seed (idempotent)  ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const [users, categories] = await Promise.all([seedUsers(), seedCategories()])
  const shops = await seedShops(users)
  const products = await seedProducts(shops, categories)
  await seedOrders(users, shops, products)

  console.log('\nConfiguring Meilisearch index…')
  await configureProductsIndex()
  console.log('Populating Meilisearch index…')
  const { synced, errors } = await populateProductsIndex()
  console.log(`Meilisearch: synced ${synced} products, ${errors} errors`)

  console.log('\n✅ Staging seed completed.')
  console.log('   Safe to re-run — existing records are skipped.\n')
}

seed()
  .then(async () => {
    await pool.end()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Staging seed failed:', err)
    await pool.end()
    process.exit(1)
  })
