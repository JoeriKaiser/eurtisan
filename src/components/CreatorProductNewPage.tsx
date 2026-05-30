import type { CreatorShop } from '#/lib/creator-dashboard'
import { ProductNewForm } from './product/ProductNewForm'
import { ProductNewNoShopState } from './product/ProductNewNoShopState'

export interface CreatorProductNewPageProps {
  shops: CreatorShop[]
  categories: Array<{ id: string; name: string; slug: string }>
}

export { CreatorProductNewLoading } from './product/CreatorProductNewLoading'
export { CreatorProductNewError } from './product/CreatorProductNewError'

export function CreatorProductNewPage({ shops, categories }: CreatorProductNewPageProps) {
  if (shops.length === 0) {
    return <ProductNewNoShopState />
  }

  return <ProductNewForm initialShops={shops} categories={categories} />
}
