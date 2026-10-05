import { createFileRoute, notFound } from '@tanstack/react-router'
import {
  CreatorProductEditError,
  CreatorProductEditLoading,
  CreatorProductEditPage,
} from '#/components/CreatorProductEditPage'
import { listCategories } from '#/lib/categories'
import { getCreatorShops } from '#/lib/creator-dashboard'
import { getCreatorProductDetail } from '#/lib/creator-products'
import { getProductVariantMatrix } from '#/lib/product-variants'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/$shopId/products/$productId/edit')({
  loader: async ({ params }) => {
    const [shops, categories, product, variantMatrix] = await Promise.all([
      getCreatorShops(),
      listCategories({ data: { tree: false } }),
      getCreatorProductDetail({ data: { productId: params.productId } }),
      getProductVariantMatrix({ data: { productId: params.productId } }),
    ])

    if (!product || product.shopId !== params.shopId) {
      throw notFound()
    }

    return { shops, categories, product, variantMatrix }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_product_edit_title()} | Eurtisan` },
      { name: 'description', content: m.creator_product_edit_description() },
    ],
  }),
  component: ShopProductEditRoute,
  pendingComponent: CreatorProductEditLoading,
  errorComponent: CreatorProductEditError,
})

function ShopProductEditRoute() {
  const { shops, categories, product, variantMatrix } = Route.useLoaderData()
  return (
    <CreatorProductEditPage
      shops={shops}
      categories={categories}
      product={product}
      variantMatrix={variantMatrix}
    />
  )
}
