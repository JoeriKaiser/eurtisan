import { HeadContent, Scripts, useLocation } from '@tanstack/react-router'
import { getLocale } from '#/paraglide/runtime'
import { UmamiScript } from '#/integrations/umami'

export function RootDocument({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        {/* Theme: see docs/THEME_HYDRATION.md — client-only class on <html> */}
        <script>{`(function(){try{var s=window.localStorage.getItem('theme'),d=window.matchMedia('(prefers-color-scheme: dark)').matches,m=s==='light'||s==='dark'?s:d?'dark':'light',r=document.documentElement;r.classList.remove('light','dark');r.classList.add(m);r.setAttribute('data-theme',m);}catch(_e){}})();`}</script>
        <HeadContent />
        {import.meta.env.DEV ? (
          // After TanStack Start route CSS: ensure design-system spacing wins on first paint.
          // Without this, dev hydration re-injects styles.css and spacing utilities jump
          // (e.g. mb-8: 32px → 64px), causing a whole-page layout shift.
          <link rel='stylesheet' href='/src/styles.css' />
        ) : null}
        {!isAdmin && <UmamiScript />}
      </head>
      <body className='font-sans antialiased [overflow-wrap:anywhere]'>
        {children}
        <script>{`document.documentElement.setAttribute('data-hydrated','true')`}</script>
        {import.meta.env.DEV ? (
          <script>{`if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister()})})}`}</script>
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
