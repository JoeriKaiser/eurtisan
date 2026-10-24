import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import {
  buildSsrI18nVirtualModule,
  compileClientI18nCatalogs,
} from './scripts/compile-client-i18n.ts'
import { PREFIXED_EU_LOCALES } from './src/lib/i18n/eu-locales.ts'
import {
  parsePublicBuildEnvironment,
  selectExplicitPublicBuildEnvironment,
} from './src/lib/infra/public-environment.ts'

const clientI18nVirtualModule = [
  "import { getLocale } from '#/paraglide/runtime';",
  '',
  'const pluralRulesCache = {};',
  'const fnCache = [];',
  'function getPluralRules(locale) {',
  '  let pr = pluralRulesCache[locale];',
  '  if (!pr) {',
  '    pr = new Intl.PluralRules(locale);',
  '    pluralRulesCache[locale] = pr;',
  '  }',
  '  return pr;',
  '}',
  'function formatTemplate(template, inputs) {',
  "  if (!inputs || !template.includes('{')) return template;",
  "  return template.replace(/\\{(\\w+)\\}/g, (_, k) => String(inputs[k] ?? ''));",
  '}',
  'function createAccessor(idx) {',
  '  return (inputs) => {',
  '    const store = globalThis.__EURTISAN_I18N__;',
  '    const entry = store ? store[idx] : undefined;',
  "    if (entry === undefined) return '';",
  "    if (typeof entry === 'string') return formatTemplate(entry, inputs);",
  '    const cat = getPluralRules(getLocale()).select(Number(inputs?.count ?? 0));',
  "    const template = entry[cat] ?? entry.other ?? Object.values(entry)[0] ?? '';",
  '    return formatTemplate(template, inputs);',
  '  };',
  '}',
  'const m = new Proxy(fnCache, {',
  '  get(target, prop) {',
  '    const idx = Number(prop);',
  '    if (Number.isInteger(idx) && idx >= 0) {',
  '      let fn = target[idx];',
  '      if (!fn) {',
  '        fn = createAccessor(idx);',
  '        target[idx] = fn;',
  '      }',
  '      return fn;',
  '    }',
  '    return () => String(prop);',
  '  }',
  '});',
  '',
  'export { m };',
  '',
].join('\n')

function readPublicBuildEnvironment(mode: string): Record<string, string | undefined> {
  if (process.env.EURTISAN_PUBLIC_ENV_ONLY === 'true') {
    return selectExplicitPublicBuildEnvironment(process.env)
  }
  return { ...loadEnv(mode, process.cwd(), ''), ...process.env }
}

const config = defineConfig(({ mode }) => {
  let keyToIndex: Record<string, number> = {}
  let ssrVirtualModuleCache: string | null = null

  return {
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
            if (id.includes('/src/paraglide/')) return 'i18n-core'
            if (!id.includes('node_modules')) return

            // Icons consolidation
            if (id.includes('lucide-react')) return 'vendor-icons'

            // Core runtime: React + DOM (must stay together)
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react/'))
              return 'vendor-react'

            // Router + Start client core
            if (id.includes('@tanstack/react-router') || id.includes('@tanstack/react-start'))
              return 'vendor-router'

            // UI primitives (Base UI, Floating UI)
            if (id.includes('@base-ui-components') || id.includes('@floating-ui'))
              return 'vendor-ui'

            // Auth client
            if (id.includes('better-auth')) return 'vendor-auth'

            // TanStack Query
            if (id.includes('@tanstack/react-query')) return 'vendor-query'
            // Schema validation
            if (id.includes('/zod/') || id.includes('node_modules/zod')) return 'vendor-zod'
          },
        },
      },
    },
    ssr: {
      external: [
        'zod',
        'better-auth',
        '@better-auth/core',
        '@better-auth/drizzle-adapter',
        'meilisearch',
      ],
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
          return {
            code: code.replaceAll('http://localhost', environment.VITE_PUBLIC_URL),
            map: null,
          }
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
      {
        name: 'eurtisan-client-i18n-runtime',
        buildStart() {
          const ordered = compileClientI18nCatalogs()
          keyToIndex = ordered.keyToIndex
          ssrVirtualModuleCache = null
        },
        load(id, options) {
          if (process.env.VITEST) {
            return null
          }
          const cleanId = id.split('?')[0].replace(/\\/g, '/')
          if (
            cleanId.endsWith('/src/paraglide/messages.js') ||
            cleanId.endsWith('/src/paraglide/messages/_index.js')
          ) {
            if (options?.ssr) {
              if (!ssrVirtualModuleCache) {
                ssrVirtualModuleCache = buildSsrI18nVirtualModule()
              }
              return ssrVirtualModuleCache
            }
            return clientI18nVirtualModule
          }
          return null
        },
        transform(code, id) {
          if (process.env.VITEST) return null
          const cleanId = id.split('?')[0].replace(/\\/g, '/')
          if (!cleanId.includes('/src/') || cleanId.includes('/src/paraglide/')) return null
          if (!/\.[jt]sx?$/.test(cleanId) || /\.test\.[jt]sx?$/.test(cleanId)) return null
          if (!code.includes('#/paraglide/messages')) return null

          let mutated = false
          const transformed = code.replace(/\bm\.([a-zA-Z0-9_]+)\b/g, (match, key: string) => {
            if (Object.hasOwn(keyToIndex, key)) {
              mutated = true
              return `m[${keyToIndex[key]}]`
            }
            return match
          })
          return mutated ? { code: transformed, map: null } : null
        },
      },
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
              ...PREFIXED_EU_LOCALES.map(
                (locale) => [locale, `/${locale}/:path(.*)?`] as [string, string],
              ),
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
  }
})

export default config
