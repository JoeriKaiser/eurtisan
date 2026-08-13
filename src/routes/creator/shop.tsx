import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import {
  CreatorShopSettingsError,
  CreatorShopSettingsLoading,
} from '#/components/CreatorShopSettingsPage'
import { CreatorShopRouteComponent } from '#/route-components/creator/shop'
import { getCreatorShop, getCreatorShops } from '#/lib/creator-dashboard'
import { guardPrivilegedRole } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

const shopSearchSchema = z.object({
  shopId: z.string().optional(),
})

export const Route = createFileRoute('/creator/shop')({
  validateSearch: shopSearchSchema,
  loaderDeps: ({ search: { shopId } }) => ({ shopId }),
  beforeLoad: async () => guardPrivilegedRole('creator'),
  loader: async ({ deps }) => {
    const shopsPromise = getCreatorShops()
    const shopPromise = deps.shopId
      ? getCreatorShop({ data: { shopId: deps.shopId } })
      : shopsPromise.then((shops) => {
          if (shops.length === 0) return null
          return getCreatorShop({ data: { shopId: shops[0].id } })
        })

    const [shops, shop] = await Promise.all([shopsPromise, shopPromise])

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
