import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { getCart } from '#/lib/cart'
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
  const [cart, setCart] = useState<CartDetail | null>(null)
  const [error, setError] = useState<Error | null>(null)
  // isLoading is genuine async state, not derived from props or other state.
  // It tracks the pending lifecycle of the getCart() fetch and must trigger
  // re-renders while loading / after resolution. Computing it during render
  // is impossible because its value depends on the timing of the async call.
  const [isLoading, setIsLoading] = useState(true)

  const refreshCart = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCart()
      setCart(data)
    } catch (err) {
      setCart(null)
      setError(err instanceof Error ? err : new Error('Failed to load cart'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCart()
  }, [refreshCart])

  const contextValue = useMemo(
    () => ({ cart, isLoading, error, refreshCart }),
    [cart, isLoading, error, refreshCart],
  )

  return <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
}

export default CartProvider

export function useCart(): CartContextType {
  return use(CartContext)
}
