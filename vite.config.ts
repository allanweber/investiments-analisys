import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * `#/db` must resolve to the real Drizzle client for SSR / server handlers.
 * `defineConfig`'s `isSsrBuild` is unreliable in `vite dev` and Nitro, which
 * led to the browser stub (`db === null`) loading on the server and breaking
 * Better Auth. Rollup's `resolveId(..., { ssr })` matches the actual graph.
 */
function viteDbClientStub(): Plugin {
  const stub = path.resolve(root, 'src/db/browser-stub.ts')
  return {
    name: 'vite-db-client-stub',
    enforce: 'pre',
    resolveId(source, _importer, options) {
      if (source !== '#/db') return null
      if (options?.ssr) return null
      return stub
    },
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Single stable CSS URL so edge-cached HTML never points at a removed hashed file after deploy.
        // JS chunks stay content-hashed under `assets/`.
        assetFileNames(assetInfo) {
          const names = (assetInfo as { names?: string[] }).names
          const name = names?.[0] ?? (assetInfo as { name?: string }).name ?? ''
          if (typeof name === 'string' && name.endsWith('.css')) {
            return 'assets/app.css'
          }
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
  },
  plugins: [
    viteDbClientStub(),
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // Avoid edge/CDN caching HTML that still points at old hashed `/assets/*` after a deploy.
      // `/assets/**` stays long-cache immutable (Nitro default); listed last so it wins over `/**`.
      routeRules: {
        '/**': {
          headers: {
            'cache-control': 'private, no-cache, must-revalidate',
          },
        },
        // Non-fingerprinted CSS: allow revalidation so deploys pick up new styles without stale immutable cache.
        '/assets/app.css': {
          headers: {
            'cache-control': 'public, max-age=86400, must-revalidate',
          },
        },
        '/assets/**': {
          headers: {
            'cache-control': 'public, max-age=31536000, immutable',
          },
        },
      },
    }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
