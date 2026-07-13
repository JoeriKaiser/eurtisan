import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import {
  parsePublicBuildEnvironment,
  selectExplicitPublicBuildEnvironment,
} from './src/lib/infra/public-environment'

function readPublicBuildEnvironment(mode: string): Record<string, string | undefined> {
  if (process.env.EURTISAN_PUBLIC_ENV_ONLY === 'true') {
    return selectExplicitPublicBuildEnvironment(process.env)
  }
  return { ...loadEnv(mode, process.cwd(), ''), ...process.env }
}

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  build: {
    // Aligns with package.json browserslist; es2022 ≈ Chrome 94+, Safari 15.4+
    minify: 'esbuild',
    target: 'es2022',
    cssMinify: true,
    // This is the measured largest-client-chunk ceiling from config/bundle-budgets.json.
    // The dedicated bundle gate also checks gzip and aggregate budgets.
    chunkSizeWarningLimit: 1245,
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
    {
      name: 'eurtisan-public-environment-contract',
      enforce: 'pre',
      config() {
        parsePublicBuildEnvironment(readPublicBuildEnvironment(mode))
      },
    },
    {
      name: 'eurtisan-remove-client-localhost-fallbacks',
      apply: 'build',
      enforce: 'post',
      renderChunk(code) {
        const environment = parsePublicBuildEnvironment(readPublicBuildEnvironment(mode))
        if (!['production', 'staging'].includes(environment.VITE_APP_ENV)) return null
        if (!code.includes('http://localhost')) return null
        return { code: code.replaceAll('http://localhost', environment.VITE_PUBLIC_URL), map: null }
      },
    },
    tanstackStart({
      router: {
        routeFileIgnorePattern:
          mode === 'production' ? '(\\.test\\.[jt]sx?$|mollie-mock-oauth)' : '\\.test\\.[jt]sx?$',
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
          localized: [
            ['nl', '/nl/:path(.*)?'],
            ['en', '/:path(.*)?'],
          ],
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
