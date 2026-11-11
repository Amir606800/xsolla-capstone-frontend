import { defineConfig } from 'vitest/config'

/**
 * Checks the app's real API code against a running backend (no mocks).
 *   LMS_API_URL=http://localhost:8080 LMS_ADMIN_EMAIL=... LMS_ADMIN_PASSWORD=... npm run test:backend
 * It creates accounts, a module, events and a team on that server, so point it at a test database.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/integration/**/*.int.test.ts'],
    env: { VITE_API_URL: process.env.LMS_API_URL ?? '' },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
