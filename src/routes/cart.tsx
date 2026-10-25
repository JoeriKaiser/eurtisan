import { createFileRoute } from '@tanstack/react-router'
import { createUtilityMeta } from '#/lib/seo'
import z from 'zod'
import { CartRouteComponent } from '#/route-components/cart'
import { getCart } from '#/lib/cart'
import { hydrateQueryData } from '#/lib/hydrate-query'
import { queryKeys } from '#/lib/query-keys'
import { m } from '#/paraglide/messages'

const cartSearchSchema = z.object({
  message: z.string().optional(),
})

export const Route = createFileRoute('/cart')({
  validateSearch: cartSearchSchema,
  loader: async ({ context }) => {
    const cart = await getCart()
    hydrateQueryData(context.queryClient, queryKeys.cart, cart)
    return { cart }
  },
  head: () =>
    createUtilityMeta({
      title: `${m.cart_title()} | Eurtisan`,
      description: m.cart_meta_description(),
    }),
  component: CartRouteComponent,
})
