import type { CreatorShop } from '#/lib/creator-dashboard'
import { ProductEditForm } from './product/ProductEditForm'
import { ProductEditNoShopState } from './product/ProductEditNoShopState'

interface ProductImageRecord {
  id: string
  url: string
  altText: string | null
  sortOrder: number
}

interface ProductDetail {
  id: string
  name: string
  description: string | null
  slug: string
  priceCents: number
  stockCount: number
  isActive: boolean
  vatRateCategory: string
  shopId: string
  categoryId: string | null
  images: ProductImageRecord[]
}

export interface CreatorProductEditPageProps {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
  product: ProductDetail
}

export { CreatorProductEditLoading } from './product/CreatorProductEditLoading'
export { CreatorProductEditError } from './product/CreatorProductEditError'

export function CreatorProductEditPage({
  shops,
  categories,
  product,
}: CreatorProductEditPageProps) {
  if (shops.length === 0) {
    return <ProductEditNoShopState />
  }

  return (
    <ProductEditForm key={product.id} shops={shops} categories={categories} product={product} />
  )
}
