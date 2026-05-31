import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications'

import { queryKeys } from './query-keys'

const notificationsKey = queryKeys.notifications
const unreadCountKey = queryKeys.unreadCount

export function useNotifications(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: queryKeys.notificationsPage(page, pageSize),
    queryFn: () => getNotifications({ data: { page, pageSize } }),
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  })
}

export function useUnreadNotificationCount(enabled = true) {
  return useQuery({
    queryKey: unreadCountKey,
    queryFn: () => getUnreadNotificationCount(),
    enabled,
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationRead({ data: { notificationId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey })
      void queryClient.invalidateQueries({ queryKey: unreadCountKey })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey })
      void queryClient.invalidateQueries({ queryKey: unreadCountKey })
    },
  })
}
