import { createFileRoute, notFound } from '@tanstack/react-router'
import ProductDetail from '#/components/ProductDetail'
import { getProductBySlug } from '#/lib/products'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/products/$productSlug')({
  loader: async ({ params }) => {
    try {
      const product = await getProductBySlug({ data: { slug: params.productSlug } })
      return { product }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product
    return {
      meta: [
        { title: product ? `${product.name} | Eurtisan` : m.meta_title_default() },
        { name: 'description', content: product?.description ?? '' },
      ],
    }
  },
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { product } = Route.useLoaderData()
  return <ProductDetail product={product} />
}
