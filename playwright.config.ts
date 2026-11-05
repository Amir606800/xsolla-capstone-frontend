import { defineConfig, devices } from '@playwright/test'

// PW_PORT lets the tests run against a fresh dev server when another one is already on 5173
// (an old dev server can serve stale modules after big file changes).
const PORT = process.env.PW_PORT ?? '5173'
const URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: true,
    // the tests always run against the offline mock API, even when .env.local points at a real backend
    env: { VITE_API_URL: process.env.E2E_API_URL ?? '' },
  },
})
