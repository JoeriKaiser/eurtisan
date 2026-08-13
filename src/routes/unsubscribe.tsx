import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'
import { unsubscribeByToken } from '#/lib/unsubscribe'
import { UnsubscribePage, UnsubscribePending } from '#/route-components/unsubscribe'

const unsubscribeSearchSchema = z.object({
  token: z.string().optional().catch(''),
  category: z.string().optional().catch(''),
})

function normalizeCategory(
  category?: string,
): 'seller_updates' | 'marketing' | 'platform_announcements' | undefined {
  return category === 'seller_updates' ||
    category === 'marketing' ||
    category === 'platform_announcements'
    ? category
    : undefined
}

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: unsubscribeSearchSchema,
  loaderDeps: ({ search: { token, category } }) => ({
    token,
    category: normalizeCategory(category),
  }),
  loader: async ({ deps }) => {
    const token = deps.token
    if (!token) return { success: false as const, category: undefined }
    try {
      const result = await unsubscribeByToken({ data: { token, category: deps.category } })
      return result.success
        ? { success: true as const, category: result.category }
        : { success: false as const, category: undefined }
    } catch {
      return { success: false as const, category: undefined }
    }
  },
  component: UnsubscribePage,
  pendingComponent: UnsubscribePending,
})
