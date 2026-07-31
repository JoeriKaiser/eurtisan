import { useLoaderData } from '@tanstack/react-router'
import ProductDetail from '#/components/ProductDetail'

export function ProductDetailPage() {
  const { product } = useLoaderData({ from: '/shops/$shopSlug/products/$productSlug' })
  // `moreFromShop` travels with the product rather than as its own loader key,
  // so the rail cannot render before the product it belongs to.
  const { moreFromShop, ...detail } = product
  return <ProductDetail product={detail} moreFromShop={moreFromShop} />
}
