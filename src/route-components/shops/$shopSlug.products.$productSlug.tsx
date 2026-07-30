import { useLoaderData } from '@tanstack/react-router'
import ProductDetail from '#/components/ProductDetail'

export function ProductDetailPage() {
  const { product } = useLoaderData({ from: '/shops/$shopSlug/products/$productSlug' })
  return <ProductDetail product={product} />
}
