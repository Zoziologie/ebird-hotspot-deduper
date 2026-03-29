import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.VITE_BASE_PATH || (mode === 'production' ? '/ebird-hotspot-deduper/' : '/')
  const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
  const appVersion = packageJson.version || '0.0.0'

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
