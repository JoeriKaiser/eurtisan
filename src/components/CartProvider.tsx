import { useQuery } from '@tanstack/react-query'
import { createContext, use, useCallback, useMemo } from 'react'
import { getCart } from '#/lib/cart'
import { queryKeys } from '#/lib/query-keys'
import type { CartDetail } from '#/lib/cart.server'

interface CartContextType {
  cart: CartDetail | null
  isLoading: boolean
  error: Error | null
  refreshCart: () => Promise<void>
}

const CartContext = createContext<CartContextType>({
  cart: null,
  isLoading: true,
  error: null,
  refreshCart: async () => {},
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const {
    data: cart,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cart,
    queryFn: () => getCart(),
    staleTime: 30_000,
  })

  const refreshCart = useCallback(async () => {
    await refetch()
  }, [refetch])

  const contextValue = useMemo(
    () => ({
      cart: cart ?? null,
      isLoading,
      error: error ?? null,
      refreshCart,
    }),
    [cart, isLoading, error, refreshCart],
  )

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
}

export default CartProvider

export function useCart(): CartContextType {
  return use(CartContext)
}
