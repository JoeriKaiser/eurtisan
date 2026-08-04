import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationsRead,
} from '../notifications'

import { queryKeys } from '../query-keys'

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

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      // The RPC boundary caps bulk mutations at 100 IDs. A daily group can be
      // larger, so preserve that bound without leaving older group members unread.
      for (let offset = 0; offset < notificationIds.length; offset += 100) {
        await markNotificationsRead({
          data: { notificationIds: notificationIds.slice(offset, offset + 100) },
        })
      }
      return { success: true as const }
    },
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
