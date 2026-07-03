import { createFileRoute, notFound } from '@tanstack/react-router'
import { NotFoundPage } from '#/components/NotFoundPage'
import { ProductDetailPage } from '#/route-components/shops/$shopSlug.products.$productSlug'
import { getProductBySlug } from '#/lib/products'
import { createPageMeta } from '#/lib/seo'
import { generateProductJsonLd } from '#/lib/seo-structured-data'
import { SUPPORTED_CURRENCY } from '#/lib/currency'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/shops/$shopSlug/products/$productSlug')({
  loader: async ({ params }) => {
    try {
      const product = await getProductBySlug({
        data: { shopSlug: params.shopSlug, productSlug: params.productSlug },
      })
      return { product }
    } catch (err) {
      if (err instanceof Response && err.status === 404) {
        throw notFound()
      }
      throw err
    }
  },
  head: ({ loaderData, params }) => {
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
    const canonicalPath = `/shops/${params.shopSlug}/products/${product.slug}`

    const images = product.images ?? []
    // Primary image (first by sortOrder)
    const primaryImage = images.length > 0 ? images[0].url : undefined

    // Price in decimal string for OG (e.g. "29.99")
    const priceAmount = (product.priceCents / 100).toFixed(2)

    // JSON-LD Product structured data
    const jsonLd = generateProductJsonLd({
      productId: product.id,
      name: product.name,
      description: product.description,
      canonicalPath,
      images,
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
      productPrice: { amount: priceAmount, currency: SUPPORTED_CURRENCY },
      jsonLd,
    })

    return { meta, links, script }
  },
  notFoundComponent: NotFoundPage,
  component: ProductDetailPage,
})
