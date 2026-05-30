import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addToCart, removeCartItem, updateCartItem } from './cart'

const cartKey = ['cart'] as const

export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { productId: string; quantity: number }) => addToCart({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cartKey })
    },
  })
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { productId: string; quantity: number }) => updateCartItem({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cartKey })
    },
  })
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { productId: string }) => removeCartItem({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cartKey })
    },
  })
}
