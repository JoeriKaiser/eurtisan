import { describe, expect, it, vi } from 'vitest'

const mockInvalidateQueries = vi.hoisted(() => vi.fn())
const mockUseQueryClient = vi.hoisted(() =>
  vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
)
const mockUseMutation = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
}))

vi.mock('./cart', () => ({
  addToCart: vi.fn(),
  updateCartItem: vi.fn(),
  removeCartItem: vi.fn(),
}))

import { useAddToCart, useRemoveCartItem, useUpdateCartItem } from './cart-hooks'

describe('useAddToCart', () => {
  it('calls useMutation with correct mutationFn', () => {
    const mutateMock = vi.fn()
    mockUseMutation.mockReturnValue({ mutate: mutateMock, isPending: false })

    const result = useAddToCart()

    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    )

    result.mutate({ productId: 'prod-1', quantity: 2 })
    expect(mutateMock).toHaveBeenCalledWith({ productId: 'prod-1', quantity: 2 })
  })

  it('invalidates cart cache on success', () => {
    mockInvalidateQueries.mockClear()

    useAddToCart()

    const captured = mockUseMutation.mock.calls[0]?.[0] as {
      onSuccess?: () => void
    }

    if (captured?.onSuccess) {
      captured.onSuccess()
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['cart'] })
  })
})

describe('useUpdateCartItem', () => {
  it('calls useMutation with correct mutationFn', () => {
    const mutateMock = vi.fn()
    mockUseMutation.mockReturnValue({ mutate: mutateMock, isPending: false })

    const result = useUpdateCartItem()

    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    )

    result.mutate({ productId: 'prod-1', quantity: 3 })
    expect(mutateMock).toHaveBeenCalledWith({ productId: 'prod-1', quantity: 3 })
  })

  it('invalidates cart cache on success', () => {
    mockInvalidateQueries.mockClear()

    useUpdateCartItem()

    const captured = mockUseMutation.mock.calls[1]?.[0] as {
      onSuccess?: () => void
    }

    if (captured?.onSuccess) {
      captured.onSuccess()
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['cart'] })
  })
})

describe('useRemoveCartItem', () => {
  it('calls useMutation with correct mutationFn', () => {
    const mutateMock = vi.fn()
    mockUseMutation.mockReturnValue({ mutate: mutateMock, isPending: false })

    const result = useRemoveCartItem()

    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    )

    result.mutate({ productId: 'prod-1' })
    expect(mutateMock).toHaveBeenCalledWith({ productId: 'prod-1' })
  })

  it('invalidates cart cache on success', () => {
    mockInvalidateQueries.mockClear()

    useRemoveCartItem()

    const captured = mockUseMutation.mock.calls[2]?.[0] as {
      onSuccess?: () => void
    }

    if (captured?.onSuccess) {
      captured.onSuccess()
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['cart'] })
  })
})
