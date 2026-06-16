import { createProduct, createShop, createUser } from '#/test/factories/core'
import { createReview } from '#/test/factories/engagement'
import { createOrderItem, createPlatformOrder, createShopOrder } from '#/test/factories/orders'

type User = Awaited<ReturnType<typeof createUser>>
type Shop = Awaited<ReturnType<typeof createShop>>
type Product = Awaited<ReturnType<typeof createProduct>>

export interface ActiveShopWithProductsResult {
  owner: User
  shop: Shop
  products: Product[]
}

export async function createActiveShopWithProducts(
  productCount = 2,
): Promise<ActiveShopWithProductsResult> {
  const owner = await createUser({ role: 'creator' })
  const shop = await createShop(owner)
  const products = await Promise.all(
    Array.from({ length: productCount }, (_, i) =>
      createProduct(shop, {
        name: `Test Product ${i + 1}`,
        slug: `test-product-${i + 1}`,
      }),
    ),
  )
  return { owner, shop, products }
}

export interface PaidOrderResult {
  buyer: User
  shop: Shop
  product: Product
  platformOrder: Awaited<ReturnType<typeof createPlatformOrder>>
  shopOrder: Awaited<ReturnType<typeof createShopOrder>>
  orderItem: Awaited<ReturnType<typeof createOrderItem>>
}

export async function createPaidOrder(overrides?: {
  buyer?: User
  shop?: Shop
  productCount?: number
}): Promise<PaidOrderResult> {
  const buyer = overrides?.buyer ?? (await createUser())
  const shopOwner = await createUser({ role: 'creator' })
  const shop = overrides?.shop ?? (await createShop(shopOwner))
  const product = await createProduct(shop, { priceCents: 1000, stockCount: 10 })
  const platformOrder = await createPlatformOrder(buyer, {
    totalCents: 1500,
    status: 'paid',
  })
  const shopOrder = await createShopOrder(platformOrder, shop, {
    subtotalCents: 1000,
    shippingCostCents: 500,
    status: 'paid',
  })
  const orderItem = await createOrderItem(shopOrder, product, {
    quantity: 1,
    unitPriceCents: product.priceCents,
    totalCents: product.priceCents,
  })
  return { buyer, shop, product, platformOrder, shopOrder, orderItem }
}

export interface DeliveredOrderWithReviewResult extends PaidOrderResult {
  review: Awaited<ReturnType<typeof createReview>>
}

export async function createDeliveredOrderWithReview(): Promise<DeliveredOrderWithReviewResult> {
  const { buyer, shop, product, platformOrder, shopOrder, orderItem } = await createPaidOrder()
  await createOrderItem(shopOrder, product, {
    quantity: 1,
    unitPriceCents: product.priceCents,
    totalCents: product.priceCents,
  })
  const deliveredShopOrder = await createShopOrder(platformOrder, shop, {
    subtotalCents: product.priceCents,
    shippingCostCents: 500,
    status: 'delivered',
    deliveredAt: new Date(),
  })
  const review = await createReview(deliveredShopOrder, product, buyer, {
    rating: 5,
    comment: 'Great product!',
  })
  return { buyer, shop, product, platformOrder, shopOrder, orderItem, review }
}
