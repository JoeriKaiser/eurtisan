import { describe, expect, it, vi } from 'vitest'

const mockInvalidateQueries = vi.hoisted(() => vi.fn())
const mockUseQueryClient = vi.hoisted(() =>
  vi.fn(() => ({ invalidateQueries: mockInvalidateQueries })),
)
const mockUseQuery = vi.hoisted(() => vi.fn())
const mockUseMutation = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient,
}))

vi.mock('./notifications', () => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from './notifications-hooks'

describe('useNotifications', () => {
  it('calls useQuery with correct key and fn', () => {
    mockUseQuery.mockReturnValue({ data: null, isPending: true })

    const result = useNotifications(2, 10)

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications', { page: 2, pageSize: 10 }],
      }),
    )
    expect(result).toEqual({ data: null, isPending: true })
  })

  it('uses default page and pageSize', () => {
    mockUseQuery.mockReturnValue({ data: null, isPending: true })

    useNotifications()

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications', { page: 1, pageSize: 20 }],
      }),
    )
  })
})

describe('useUnreadNotificationCount', () => {
  it('calls useQuery with unread-count key', () => {
    mockUseQuery.mockReturnValue({ data: { count: 3 }, isPending: false })

    const result = useUnreadNotificationCount()

    expect(mockUseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications', 'unread-count'],
      }),
    )
    expect(result.data?.count).toBe(3)
  })
})

describe('useMarkNotificationRead', () => {
  it('calls useMutation with correct mutationFn', () => {
    const mutateMock = vi.fn()
    mockUseMutation.mockReturnValue({ mutate: mutateMock, isPending: false })

    const result = useMarkNotificationRead()

    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    )

    result.mutate('notif-1')
    expect(mutateMock).toHaveBeenCalledWith('notif-1')
  })

  it('invalidates caches on success', () => {
    mockInvalidateQueries.mockClear()

    const captured = mockUseMutation.mock.calls[0]?.[0] as {
      onSuccess?: () => void
    }

    if (captured?.onSuccess) {
      captured.onSuccess()
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications', 'unread-count'],
    })
  })
})

describe('useMarkAllNotificationsRead', () => {
  it('calls useMutation with correct mutationFn', () => {
    const mutateMock = vi.fn()
    mockUseMutation.mockReturnValue({ mutate: mutateMock, isPending: false })

    const result = useMarkAllNotificationsRead()

    expect(mockUseMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationFn: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    )

    result.mutate()
    expect(mutateMock).toHaveBeenCalled()
  })

  it('invalidates caches on success', () => {
    mockInvalidateQueries.mockClear()

    const captured = mockUseMutation.mock.calls[1]?.[0] as {
      onSuccess?: () => void
    }

    if (captured?.onSuccess) {
      captured.onSuccess()
    }

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['notifications'] })
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['notifications', 'unread-count'],
    })
  })
})
