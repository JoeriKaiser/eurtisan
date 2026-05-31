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
        {!isAdmin && <UmamiScript />}
      </head>
      <body className='font-sans antialiased [overflow-wrap:anywhere]'>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
