import { createFileRoute, notFound } from '@tanstack/react-router'
import ProductDetail from '#/components/ProductDetail'
import { getProductBySlug } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateProductJsonLd } from '#/lib/seo-structured-data'
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
    if (!product) {
      const { meta, links } = createPageMeta({
        title: m.meta_title_default(),
        description: m.meta_default_description(),
        canonicalPath: '/',
      })
      return { meta, links }
    }

    const title = `${product.name} | Eurtisan`
    const description = product.description ?? m.meta_default_description()
    const canonicalPath = `/products/${product.slug}`

    // Primary image (first by sortOrder)
    const primaryImage = product.images.length > 0 ? product.images[0].url : undefined

    // Price in decimal string for OG (e.g. "29.99")
    const priceAmount = (product.priceCents / 100).toFixed(2)

    // JSON-LD Product structured data
    const jsonLd = generateProductJsonLd({
      productId: product.id,
      name: product.name,
      description: product.description,
      canonicalPath,
      images: product.images,
      price: priceAmount,
      stockCount: product.stockCount,
      brandName: product.shopName ?? undefined,
      categoryName: product.categoryName,
    })

    const { meta, links, script } = createPageMeta({
      title,
      description,
      canonicalPath,
      ogType: 'product',
      ogImageUrl: primaryImage,
      productPrice: { amount: priceAmount, currency: 'EUR' },
      jsonLd,
    })

    return { meta, links, script }
  },
  component: ProductDetailPage,
})

function ProductDetailPage() {
  const { product } = Route.useLoaderData()
  return <ProductDetail product={product} />
}
