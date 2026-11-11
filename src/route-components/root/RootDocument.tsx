import { HeadContent, Scripts, useLocation } from '@tanstack/react-router'
import { getLocale } from '#/paraglide/runtime'
import { UmamiScript } from '#/integrations/umami'
import { THEME_INIT_SCRIPT } from '#/lib/security/theme-script'
import { markDocumentHydrated } from './hydration-readiness'

export function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        {/* Theme: see docs/THEME_HYDRATION.md: client-only class on <html> */}
        <script>{THEME_INIT_SCRIPT}</script>
        <script defer src={`/i18n/${getLocale()}.js`} />
        <HeadContent />
        {import.meta.env.DEV ? (
          // After TanStack Start route CSS: ensure design-system spacing wins on first paint.
          // Without this, dev hydration re-injects styles.css and spacing utilities jump
          // (e.g. mb-8: 32px → 64px), causing a whole-page layout shift.
          <link rel='stylesheet' href='/src/styles.css' />
        ) : null}
        {!isAdmin && <UmamiScript />}
      </head>
      <body ref={markDocumentHydrated} className='font-sans antialiased [overflow-wrap:anywhere]'>
        {children}
        {import.meta.env.DEV ? (
          <script>{`if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister()})})}`}</script>
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
