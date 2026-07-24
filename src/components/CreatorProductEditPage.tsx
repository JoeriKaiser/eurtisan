import type { CreatorShop } from '#/lib/creator-dashboard'
import type { ProductVariantMatrix } from '#/lib/product-variants'
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
  returnPolicy: string
  shopId: string
  categoryId: string | null
  weightGrams: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  images: ProductImageRecord[]
}

export interface CreatorProductEditPageProps {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
  product: ProductDetail
  variantMatrix?: ProductVariantMatrix
}

export { CreatorProductEditLoading } from './product/CreatorProductEditLoading'
export { CreatorProductEditError } from './product/CreatorProductEditError'

export function CreatorProductEditPage({
  shops,
  categories,
  product,
  variantMatrix = { productId: product.id, options: [], variants: [] },
}: CreatorProductEditPageProps) {
  if (shops.length === 0) {
    return <ProductEditNoShopState />
  }

  return (
    <ProductEditForm
      key={product.id}
      shops={shops}
      categories={categories}
      product={product}
      variantMatrix={variantMatrix}
    />
  )
}
