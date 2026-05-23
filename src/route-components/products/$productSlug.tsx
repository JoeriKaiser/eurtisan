import ProductDetail from '#/components/ProductDetail'
import { useLoaderData } from '@tanstack/react-router'

export function ProductDetailPage() {
  const { product } = useLoaderData({ from: '/products/$productSlug' })
  return <ProductDetail product={product} />
}
