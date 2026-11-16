import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

// Let the app be opened through an ngrok tunnel (Vite blocks unknown host names by default).
const tunnelHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Without VITE_API_URL the app calls /api on its own address; in development (and `vite preview`) this forwards those
  // calls to the Go server, so there is no cross-site request and no CORS to set up. Production does the same with a
  // reverse proxy in front of the built files.
  const apiProxy = {
    '/api': {
      target: env.API_PROXY_TARGET || 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api/, ''),
    },
  }

  return {
    plugins: [react()],
    preview: {
      allowedHosts: tunnelHosts,
      proxy: apiProxy,
    },
    server: {
      allowedHosts: tunnelHosts,
      proxy: apiProxy,
      watch: {
        // Test output and build artefacts change constantly while tests run;
        // watching them makes the dev server reload pages mid-test.
        ignored: ['**/test-results/**', '**/playwright-report/**', '**/dist/**', '**/coverage/**'],
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // the tests never reach a server: test/setup.ts fakes the API modules; tests of the real HTTP calls stub the URL
      env: { VITE_API_URL: '' },
      include: ['src/**/*.test.{ts,tsx}'],
      // against a live server only: npm run test:backend (vitest.backend.config.ts)
      exclude: [...configDefaults.exclude, 'src/integration/**'],
      css: false,
    },
  }
})
