import { useLoaderData } from '@tanstack/react-router'
import ShopStorefront from './ShopStorefront'

export function ShopRouteComponent() {
  const { shop, products, categories, searchQuery, categorySlug, inStockOnly, sort } =
    useLoaderData({ from: '/shops/$shopSlug/' })
  return (
    <ShopStorefront
      shop={shop}
      products={products}
      categories={categories}
      searchQuery={searchQuery}
      categorySlug={categorySlug}
      inStockOnly={inStockOnly}
      sort={sort}
    />
  )
}
