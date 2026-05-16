import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    viteReact(),
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'message-modules',
      cookieName: 'PARAGLIDE_LOCALE',
      strategy: ['url', 'cookie', 'preferredLanguage', 'baseLocale'],
      urlPatterns: [
        {
          pattern: '/:path(.*)?',
          localized: [['en', '/:path(.*)?']],
        },
      ],
    }),
    // devtools() disabled — its data-tsd-source instrumentation causes hydration
    // mismatches in dev (server/client line numbers diverge). Re-enable when the
    // plugin supports stable hashes or suppressHydrationWarning propagation.
    // devtools(),
  ],
})

export default config
