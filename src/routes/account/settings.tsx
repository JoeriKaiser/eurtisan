import { createFileRoute } from '@tanstack/react-router'
import { AccountSettings } from '#/route-components/account/settings'
import { AccountShell } from '#/components/AccountShell'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/settings')({
  beforeLoad: async () => guardAuth(),
  loader: async () => {
    const { getMyEmailPreferences } = await import('#/lib/account-email-preferences')
    const preferences = await getMyEmailPreferences()
    return { preferences }
  },
  head: () => ({
    meta: [
      { title: `${m.account_settings()} | Eurtisan` },
      { name: 'description', content: m.account_settings() },
    ],
  }),
  component: AccountSettingsRoute,
})

function AccountSettingsRoute() {
  return (
    <AccountShell
      breadcrumbs={[
        { label: m.nav_home(), to: '/' },
        { label: m.account_title(), to: '/account' },
        { label: m.account_settings() },
      ]}
    >
      <AccountSettings />
    </AccountShell>
  )
}
