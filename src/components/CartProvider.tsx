import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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
  isLoading: false,
  error: null,
  refreshCart: async () => {},
})

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refreshCart = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCart({ data: {} })
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

  return (
    <CartContext.Provider value={{ cart, isLoading, error, refreshCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextType {
  return useContext(CartContext)
}
