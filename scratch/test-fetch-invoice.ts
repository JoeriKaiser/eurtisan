import { db } from '../src/db/index'
import { invoices } from '../src/db/schema'

async function main() {
  const records = await db.select().from(invoices).limit(5)
  console.log('Fetched Invoices count:', records.length)
  for (const r of records) {
    console.log(`Invoice ${r.invoiceNumber}:`, {
      type: r.type,
      billingDetails: r.billingDetails,
    })
  }
}
main()
