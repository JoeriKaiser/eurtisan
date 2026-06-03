import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  build: {
    // Aligns with package.json browserslist; es2022 ≈ Chrome 94+, Safari 15.4+
    minify: 'esbuild',
    target: 'es2022',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor'
          if (id.includes('@tanstack/react-router') || id.includes('@tanstack/react-start'))
            return 'router'
          if (id.includes('@tanstack/react-query')) return 'query'
        },
      },
    },
  },
  ssr: {
    external: ['zod', 'better-auth', '@better-auth/core', '@better-auth/drizzle-adapter'],
  },
  plugins: [
    tanstackStart({
      router: {
        routeFileIgnorePattern: mode === 'production' ? 'mollie-mock-oauth' : undefined,
      },
    }),
    viteReact(),
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      outputStructure: 'locale-modules',
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
}))

export default config
