import { expect, test } from '@playwright/test'

const STUDENT = { id: 1, name: 'Sam', email: 'student@xsolla.school', roles: ['student'] }

test.beforeEach(async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), STUDENT)
})

test('a page whose code is slow to arrive shows the loader, never a blank screen', async ({ page }) => {
  await page.route('**/src/pages/CalendarPage.tsx*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    await route.continue()
  })
  // opened directly (a first visit): there is no earlier page to keep on screen while it loads
  await page.goto('/calendar', { waitUntil: 'commit' })
  const loader = page.getByRole('progressbar', { name: 'Loading the page' })
  await expect(loader).toBeVisible()
  await expect(loader.locator('.spinner')).toBeVisible()
  // the shell stays around it
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await expect(loader).toHaveCount(0)
})

for (const theme of ['light', 'dark'] as const) {
  test(`before the app starts there is a spinner in the ${theme} colours, not a white or black screen`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme)
    // hold the app's own code back so the first screen can be looked at
    await page.route('**/src/main.tsx*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await page.goto('/login', { waitUntil: 'commit' })
    const boot = page.locator('.boot')
    await expect(boot).toBeVisible()
    await expect(page.locator('.boot__ring')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    expect(bg).toBe(theme === 'dark' ? 'rgb(23, 32, 35)' : 'rgb(246, 246, 245)')
    // then the app takes over
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
    await expect(boot).toHaveCount(0)
  })
}

/**
 * The placeholders only show while the (fake) data loads, a fraction of a second: instead of racing that,
 * a watcher inside the page records the moment they appear (and how wide the page was at that moment).
 */
async function watchPlaceholders(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const seen = { shown: false, overflow: 0 }
    ;(window as unknown as { __skeleton: typeof seen }).__skeleton = seen
    new MutationObserver(() => {
      if (seen.shown || !document.querySelector('.skeleton-dash')) return
      seen.shown = true
      seen.overflow = document.documentElement.scrollWidth - window.innerWidth
    }).observe(document, { childList: true, subtree: true })
  })
}
const placeholders = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __skeleton: { shown: boolean; overflow: number } }).__skeleton)

test('the dashboard shows placeholder cards while its course loads, and they are gone afterwards', async ({ page }) => {
  await watchPlaceholders(page)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  expect((await placeholders(page)).shown).toBe(true)
  await expect(page.locator('.skeleton-dash')).toHaveCount(0)
})

test('the placeholders fit a phone screen', async ({ page }) => {
  await watchPlaceholders(page)
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  const seen = await placeholders(page)
  expect(seen.shown).toBe(true)
  expect(seen.overflow).toBeLessThanOrEqual(0)
})
