import { createFileRoute } from '@tanstack/react-router'
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
  head: () => ({
    meta: [
      { title: `${m.cart_title()} | Eurtisan` },
      { name: 'description', content: m.cart_meta_description() },
    ],
  }),
  component: CartRouteComponent,
})
