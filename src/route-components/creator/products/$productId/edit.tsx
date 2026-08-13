import { CreatorProductEditPage } from '#/components/CreatorProductEditPage'
import { useLoaderData } from '@tanstack/react-router'

export function CreatorProductEditRouteComponent() {
  const { shops, categories, product, variantMatrix } = useLoaderData({
    from: '/creator/products/$productId/edit',
  })
  return (
    <CreatorProductEditPage
      shops={shops}
      categories={categories}
      product={product}
      variantMatrix={variantMatrix}
    />
  )
}
