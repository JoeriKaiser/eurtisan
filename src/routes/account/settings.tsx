import { createFileRoute } from '@tanstack/react-router'
import { AccountSettings } from '#/route-components/account/settings'
import { guardAuth } from '#/lib/route-guards'

export const Route = createFileRoute('/account/settings')({
  beforeLoad: async () => guardAuth(),
  component: AccountSettings,
})
