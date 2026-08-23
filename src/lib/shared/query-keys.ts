/** Shared React Query keys — keep in sync with route loader hydration. */
export const queryKeys = {
  cart: ['cart'] as const,
  categoriesList: ['categories-list'] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  notificationsPage: (page: number, pageSize: number) =>
    [...queryKeys.notifications, { page, pageSize }] as const,
}
