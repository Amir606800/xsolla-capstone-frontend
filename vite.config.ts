import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// Let the app be opened through an ngrok tunnel (Vite blocks unknown host names by default).
const tunnelHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io']

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'serve' && mode !== 'test' && !env.VITE_API_URL?.trim()) {
    throw new Error('VITE_API_URL is required. Add it to .env.local before starting the frontend.')
  }

  return {
    plugins: [react()],
    preview: {
      allowedHosts: tunnelHosts,
    },
    server: {
      allowedHosts: tunnelHosts,
      watch: {
        // Test output and build artefacts change constantly while tests run;
        // watching them makes the dev server reload pages mid-test.
        ignored: ['**/test-results/**', '**/playwright-report/**', '**/dist/**', '**/coverage/**'],
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // API tests explicitly stub the URL when they need a backend.
      env: { VITE_API_URL: '' },
      include: ['src/**/*.test.{ts,tsx}'],
      // against a live server only: npm run test:backend (vitest.backend.config.ts)
      exclude: [...configDefaults.exclude, 'src/integration/**'],
      css: false,
    },
  }
})
