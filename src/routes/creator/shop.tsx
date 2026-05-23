import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import {
  CreatorShopSettingsError,
  CreatorShopSettingsLoading,
} from '#/components/CreatorShopSettingsPage'
import { CreatorShopRouteComponent } from '#/route-components/creator/shop'
import { getCreatorShop, getCreatorShops } from '#/lib/creator-dashboard'
import { guardRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const shopSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/shop')({
  validateSearch: shopSearchSchema,
  loaderDeps: ({ search: { shopId } }) => ({ shopId }),
  beforeLoad: async () => guardRole('creator'),
  loader: async ({ deps }) => {
    const shops = await getCreatorShops()

    if (shops.length === 0) {
      return { shop: null, allShops: [] }
    }

    const targetShopId = deps.shopId ?? shops[0].id
    const shop = await getCreatorShop({ data: { shopId: targetShopId } })

    return { shop, allShops: shops }
  },
  head: () => ({
    meta: [
      { title: `${m.creator_shop_settings_title()} | Eurtisan` },
      { name: 'description', content: m.creator_shop_settings_description() },
    ],
  }),
  component: CreatorShopRouteComponent,
  pendingComponent: CreatorShopSettingsLoading,
  errorComponent: CreatorShopSettingsError,
})
