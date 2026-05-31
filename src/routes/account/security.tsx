import { createFileRoute } from '@tanstack/react-router'
import { AccountSecurity } from '#/route-components/account/security'
import { guardAuth } from '#/lib/route-guards'
import { m } from '#/paraglide/messages'

export const Route = createFileRoute('/account/security')({
  beforeLoad: async () => guardAuth('/account/security'),
  head: () => ({
    meta: [
      { title: `${m.account_security_title()} | Eurtisan` },
      { name: 'description', content: m.account_security_description() },
    ],
  }),
  component: AccountSecurity,
})
