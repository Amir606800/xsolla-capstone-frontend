import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Let the app be opened through an ngrok tunnel (Vite blocks unknown host names by default).
const tunnelHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.io']

// https://vite.dev/config/
export default defineConfig({
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
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
