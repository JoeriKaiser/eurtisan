import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '#/db/index'
import { invoices } from '#/db/schema'
import { decryptJsonb, encryptJsonb } from '#/lib/encryption.server'
import { invoiceBillingDetailsSchema } from '#/lib/invoices'
import {
  createCreditNoteForShopOrder,
  createInvoicesForPlatformOrder,
  getInvoiceByIdQuery,
} from '#/lib/invoices.server'
import type { BillingDetails } from '#/lib/invoices/types'
import { clearTestTables } from '#/test/cleanup'
import {
  createInvoice,
  createOrderItem,
  createPlatformOrder,
  createProduct,
  createShop,
  createShopOrder,
  createUser,
} from '#/test/factories'

/**
 * Guards the jsonb columns that are encrypted at rest.
 *
 * `shop.shippingOrigin` and `shop.businessAddress` are written with
 * `encryptJsonb` (`src/lib/shops/settings.server.ts`). `decryptJsonb` passes
 * plaintext through unchanged so legacy rows keep working — which means a read
 * site that forgets to decrypt does not throw. It receives a base64 string,
 * every property access on it yields `undefined`, and the failure is silent.
 *
 * That is not hypothetical. Ten sites shipped this way across checkout,
 * invoicing, fulfillment, shop settings, and the homepage stats, including the
 * `sellerCountry` that decides VAT reverse charge. Nothing caught it because
 * the seed and the test factories both wrote plaintext, so every non-production
 * environment took the legacy-passthrough branch.
 *
 * The two scans are static checks: they cover read sites that have no test of
 * their own, which is exactly where the bugs were. The behavioural tests at
 * the bottom extend the same guarantee to `platform_order.billing_address`
 * (written encrypted by checkout) and `invoices.billing_details` (snapshotted
 * into every document the invoicing engine emits): new writes land as
 * ciphertext, reads decrypt both vintages, and the credit-note path tolerates
 * a legacy plaintext row.
 */

const ENCRYPTED_COLUMNS = ['shippingOrigin', 'businessAddress'] as const

/** `x.shippingOrigin as SomeType` — a cast that skips decryption. */
const RAW_CAST = new RegExp(`\\.(${ENCRYPTED_COLUMNS.join('|')})\\s+as\\s`, 'g')

/** `shipping_origin->>'country'` — SQL cannot see inside the ciphertext. */
const SQL_EXTRACTION =
  /(shippingOrigin|shipping_origin|businessAddress|business_address)\s*}?\s*->>/g

/**
 * Files allowed to name these columns without decrypting.
 *
 * `legal-identity.ts` takes `unknown` and is called only with already-decrypted
 * values. The seed reads back its own in-memory plaintext, before the encrypting
 * insert. Both are deliberate; anything else added here needs a reason.
 */
const ALLOWED: Record<string, true> = {
  'src/lib/shops/legal-identity.ts': true,
  'src/db/seed.ts': true,
  'src/test/encrypted-column-reads.test.ts': true,
}

const REPO_ROOT = join(import.meta.dirname, '../..')

function sourceFiles(directory = join(REPO_ROOT, 'src')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...sourceFiles(absolute))
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(absolute)
    }
  }
  return found
}

function scanFor(pattern: RegExp): string[] {
  const offenders: string[] = []
  for (const absolute of sourceFiles()) {
    const path = relative(REPO_ROOT, absolute)
    if (ALLOWED[path]) continue
    const contents = readFileSync(absolute, 'utf8')
    for (const match of contents.matchAll(pattern)) {
      const line = contents.slice(0, match.index).split('\n').length
      offenders.push(`${path}:${line} — ${match[0].trim()}`)
    }
  }
  return offenders
}

describe('encrypted shop columns', () => {
  it('are never read with a raw cast that skips decryption', () => {
    expect(scanFor(RAW_CAST)).toEqual([])
  })

  it('are never queried with SQL json extraction, which cannot read ciphertext', () => {
    expect(scanFor(SQL_EXTRACTION)).toEqual([])
  })
})

describe('encrypted invoices.billing_details', () => {
  const originalVatLiable = process.env.PLATFORM_VAT_LIABLE

  beforeEach(async () => {
    process.env.PLATFORM_VAT_LIABLE = 'false'
    await clearTestTables()
  })

  afterEach(() => {
    process.env.PLATFORM_VAT_LIABLE = originalVatLiable
  })

  /**
   * Seeds one paid order shaped the way production shapes it: checkout stores
   * the buyer's billing address encrypted, the shop factory stores its address
   * columns encrypted, and a single line item keeps the invoice snapshot
   * predictable. Returns the generated invoice numbers alongside the rows.
   */
  async function seedInvoicedOrder() {
    const buyer = await createUser({ name: 'Jane Buyer', email: 'jane@example.com' })
    const owner = await createUser({
      name: 'Otto Artisan',
      email: 'otto@example.com',
      role: 'creator',
    })
    const shopRecord = await createShop(owner, {
      name: 'Atelier Otto',
      isVatRegistered: true,
      vatId: 'DE999999999',
      businessAddress: {
        street: '10 Rue de la Paix',
        city: 'Paris',
        postalCode: '75002',
        country: 'FR',
      },
    })

    // checkout/order-persistence.server.ts writes platform_order.billing_address
    // encrypted, so store ciphertext here too — going through the legacy
    // passthrough branch would re-hide exactly the bug under test.
    const billingAddress = {
      name: 'Jane Buyer',
      street: 'Leipziger Str. 12',
      city: 'Berlin',
      postalCode: '10117',
      country: 'DE',
    }
    const po = await createPlatformOrder(buyer.id, {
      billingAddress: encryptJsonb(billingAddress),
    })

    const product = await createProduct(shopRecord, { name: 'Wooden Clock', priceCents: 2000 })
    const so = await createShopOrder(po, shopRecord, {
      subtotalCents: 2000,
      vatAmountCents: 380,
      shippingCostCents: 500,
      shippingVatRateBasisPoints: 1900,
      shippingVatAmountCents: 80,
    })
    await createOrderItem(so, product, {
      productName: 'Wooden Clock',
      unitPriceCents: 2000,
      quantity: 1,
      totalCents: 2000,
      vatRateBasisPoints: 1900,
      vatAmountCents: 380,
    })

    const created = await createInvoicesForPlatformOrder(po.id)
    const numbers = created.get(so.id)
    expect(numbers).toBeDefined()
    if (!numbers) throw new Error('Expected invoice numbers for shop order')

    return { so, ...numbers }
  }

  it('writes customer and platform fee invoices with billing_details encrypted at rest', async () => {
    const { so } = await seedInvoicedOrder()

    const rows = await db.select().from(invoices).where(eq(invoices.shopOrderId, so.id))
    expect(rows.map((row) => row.type).sort()).toEqual(['customer', 'platform_fee'])

    for (const row of rows) {
      // A base64 ciphertext blob is not valid JSON and carries no plaintext.
      expect(typeof row.billingDetails).toBe('string')
      expect(() => JSON.parse(row.billingDetails as string)).toThrow()
      expect(row.billingDetails).not.toContain('Jane Buyer')
    }
  })

  it('returns decrypted billing details with fields intact from getInvoiceByIdQuery', async () => {
    const { customerInvoiceNumber, platformFeeInvoiceNumber } = await seedInvoicedOrder()

    const customerInvoice = await getInvoiceByIdQuery(customerInvoiceNumber, 'reader', 'admin')
    // The exact contract getInvoiceData depends on (src/lib/invoices.ts): the
    // Zod schema must accept the returned value, which fails on ciphertext.
    const parsedCustomer = invoiceBillingDetailsSchema.safeParse(customerInvoice.billingDetails)
    expect(parsedCustomer.success).toBe(true)
    if (!parsedCustomer.success) throw new Error('Expected customer billing details to parse')
    expect(parsedCustomer.data.from.name).toBe('Atelier Otto')
    expect(parsedCustomer.data.from.address.country).toBe('FR')
    expect(parsedCustomer.data.from.vatId).toBe('DE999999999')
    // Buyer fields prove the encrypted platform_order.billing_address was
    // decrypted before the snapshot was built.
    expect(parsedCustomer.data.to.name).toBe('Jane Buyer')
    expect(parsedCustomer.data.to.address.street).toBe('Leipziger Str. 12')
    expect(parsedCustomer.data.to.address.city).toBe('Berlin')
    expect(parsedCustomer.data.items).toEqual([
      {
        id: expect.any(String),
        name: 'Wooden Clock',
        quantity: 1,
        unitPriceCents: 2000,
        totalCents: 2000,
        vatRateBasisPoints: 1900,
        vatAmountCents: 380,
      },
    ])
    expect(parsedCustomer.data.shipping).toEqual({
      costCents: 500,
      vatRateBasisPoints: 1900,
      vatAmountCents: 80,
      method: 'standard',
    })
    expect(parsedCustomer.data.reverseCharge).toBe(false)

    const feeInvoice = await getInvoiceByIdQuery(platformFeeInvoiceNumber, 'reader', 'admin')
    const parsedFee = invoiceBillingDetailsSchema.safeParse(feeInvoice.billingDetails)
    expect(parsedFee.success).toBe(true)
    if (!parsedFee.success) throw new Error('Expected fee billing details to parse')
    expect(parsedFee.data.from.name).toBe('Eurtisan Platform')
    expect(parsedFee.data.to.name).toBe('Atelier Otto (c/o Otto Artisan)')
    expect(parsedFee.data.items[0]?.id).toBe('platform-commission')
  })

  it('reads a legacy plaintext invoice and stores its credit note encrypted', async () => {
    // Order skeleton plus a pre-encryption vintage customer invoice whose
    // billing_details is a plain jsonb object, like rows written before the
    // encryption migration.
    const buyer = await createUser()
    const owner = await createUser({ role: 'creator' })
    const shopRecord = await createShop(owner)
    const po = await createPlatformOrder(buyer.id)
    const so = await createShopOrder(po, shopRecord)

    const legacyDetails: BillingDetails = {
      from: {
        name: 'Legacy Atelier',
        address: { street: '1 Old Lane', city: 'Lyon', postalCode: '69001', country: 'FR' },
      },
      to: {
        name: 'Legacy Buyer',
        address: { street: '2 Old Lane', city: 'Lyon', postalCode: '69001', country: 'FR' },
      },
      items: [
        {
          id: 'legacy-item',
          name: 'Legacy Soap',
          quantity: 1,
          unitPriceCents: 1200,
          totalCents: 1200,
          vatRateBasisPoints: 2000,
          vatAmountCents: 200,
        },
      ],
    }
    const legacy = await createInvoice(so.id, {
      invoiceNumber: 'INV-LEGACY-1',
      billingDetails: legacyDetails,
      subtotalCents: 1000,
      vatAmountCents: 200,
      totalCents: 1200,
    })
    expect(typeof legacy.billingDetails).toBe('object')

    // The read path passes legacy plaintext through unchanged.
    const record = await getInvoiceByIdQuery('INV-LEGACY-1', 'reader', 'admin')
    expect(record.billingDetails).toEqual(legacyDetails)

    // The credit-note path must not crash on plaintext and stores its own
    // copy encrypted, consistent with newly written invoices.
    const creditNoteNumber = await createCreditNoteForShopOrder(so.id)
    expect(creditNoteNumber).toMatch(/^CN-\d{4}-\d{5}$/)
    if (!creditNoteNumber) throw new Error('Expected credit note number')

    const [note] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceNumber, creditNoteNumber))
    expect(note.type).toBe('credit_note')
    expect(typeof note.billingDetails).toBe('string')
    expect(decryptJsonb<BillingDetails>(note.billingDetails)).toEqual(legacyDetails)
  })
})
