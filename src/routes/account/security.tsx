import { createFileRoute } from '@tanstack/react-router'
import { createUtilityMeta } from '#/lib/seo'
import { AccountSecurity } from '#/route-components/account/security'
import { AccountShell } from '#/components/AccountShell'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/security')({
  beforeLoad: async () => guardAuth('/account/security'),
  head: () =>
    createUtilityMeta({
      title: `${m.account_security_title()} | Eurtisan`,
      description: m.account_security_description(),
    }),
  component: AccountSecurityRoute,
})

function AccountSecurityRoute() {
  return (
    <AccountShell
      breadcrumbs={[
        { label: m.nav_home(), to: '/' },
        { label: m.account_title(), to: '/account' },
        { label: m.account_settings(), to: '/account/settings' },
        { label: m.account_security_title() },
      ]}
    >
      <AccountSecurity />
    </AccountShell>
  )
}
