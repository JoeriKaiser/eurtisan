import { createFileRoute } from '@tanstack/react-router'
import {
  CreatorShopSettingsError,
  CreatorShopSettingsLoading,
  CreatorShopSettingsPage,
} from '#/components/CreatorShopSettingsPage'
import { getCreatorShop, getCreatorShops } from '#/lib/creator-dashboard'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/studio/$shopId/settings/')({
  loader: async ({ params }) => {
    const [shops, shop] = await Promise.all([
      getCreatorShops(),
      getCreatorShop({ data: { shopId: params.shopId } }),
    ])

    return { shop, allShops: shops }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_shop_settings_title()} | Eurtisan` },
      { name: 'description', content: m.creator_shop_settings_description() },
    ],
  }),
  component: ShopSettingsRoute,
  pendingComponent: CreatorShopSettingsLoading,
  errorComponent: CreatorShopSettingsError,
})

function ShopSettingsRoute() {
  const { shop, allShops } = Route.useLoaderData()
  return <CreatorShopSettingsPage shop={shop} allShops={allShops} />
}
