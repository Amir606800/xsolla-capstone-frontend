import { expect, test } from '@playwright/test'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
    )
  })
  await page.goto('/calendar')
  await expect(page.getByRole('group', { name: 'Month view' })).toBeVisible()
})

const cells = (page: import('@playwright/test').Page) => page.getByRole('group', { name: 'Month view' }).getByRole('button')

test('shows the current month on top and a 6-week grid', async ({ page }) => {
  const now = new Date()
  await expect(page.getByRole('heading', { name: `${MONTHS[now.getMonth()]} ${now.getFullYear()}`, level: 2 })).toBeVisible()
  await expect(cells(page)).toHaveCount(42)
  await expect(page.locator('.cell.is-today')).toHaveCount(1)
})

test('the grid covers the page width and each date box is a usable size', async ({ page, isMobile }) => {
  const grid = await page.locator('.month').boundingBox()
  const main = await page.getByRole('main').boundingBox()
  expect(grid!.width).toBeGreaterThan(main!.width * 0.85)

  const cell = await cells(page).first().boundingBox()
  expect(cell!.height).toBeGreaterThan(isMobile ? 45 : 80)
})

test('events are indicated inside date boxes', async ({ page, isMobile }) => {
  // mock data is sparse on purpose (weekly lecture, biweekly 1:1, deadlines), but never empty
  const withEvents = page.locator('.cell:has(.ev)')
  expect(await withEvents.count()).toBeGreaterThanOrEqual(3)
  expect(await withEvents.count()).toBeLessThan(25)

  if (isMobile) {
    await expect(page.locator('.cell__dots').first()).toBeVisible()
    await expect(page.locator('.cell__events').first()).toBeHidden()
  } else {
    await expect(page.locator('.cell__events .ev', { hasText: 'Lecture' }).first()).toBeVisible()
    await expect(page.locator('.cell__events .ev__time').first()).toHaveText(/^\d\d:\d\d$/)
  }
})

test('previous / next / today navigation', async ({ page }) => {
  const label = page.getByRole('heading', { level: 2 }).first()
  const start = await label.textContent()

  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(label).not.toHaveText(start!)
  await expect(cells(page)).toHaveCount(42)

  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(label).toHaveText(start!)

  await page.getByRole('button', { name: 'Previous month' }).click()
  await page.getByRole('button', { name: 'Today' }).click()
  await expect(label).toHaveText(start!)
  await expect(page.locator('.cell.is-today')).toHaveCount(1)
})

test('clicking a date opens a pop-up with the details of that day', async ({ page }) => {
  const day = page.locator('.cell:has(.ev)').first()
  await day.click()
  await expect(day).toHaveAttribute('aria-pressed', 'true')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('list', { name: 'Events' }).getByRole('listitem').first()).toContainText(/\d\d:\d\d|All day/)
  // the page behind must not scroll while it is open
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
})

test('the pop-up closes with Escape, the close button and a click outside; focus returns to the date', async ({ page }) => {
  const day = page.locator('.cell:has(.ev)').first()

  await day.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(day).toBeFocused()

  await day.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await day.click()
  await page.mouse.click(5, 5) // on the dimmed backdrop
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('an empty day opens a pop-up saying there is nothing', async ({ page }) => {
  const empty = page.locator('.cell:not(:has(.ev))').filter({ hasNot: page.locator('.is-outside') }).first()
  await empty.click()
  await expect(page.getByRole('dialog')).toContainText('No events on this day.')
})

test('the pop-up fits the screen, even on a phone', async ({ page }) => {
  await page.locator('.cell:has(.ev)').first().click()
  const box = (await page.locator('.modal').boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
})

test('opens the module from a deadline in the pop-up', async ({ page }) => {
  // find a month cell holding a deadline (module deadlines are around today)
  await page.locator('.cell:has(.ev--deadline)').first().click()
  await page.getByRole('dialog').getByRole('link', { name: 'Open module' }).first().click()
  await expect(page).toHaveURL(/\/courses\/m\d+$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('no horizontal overflow, in light and dark', async ({ page }) => {
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await overflow()).toBe(false)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await overflow()).toBe(false)
})

test('reachable from the sidebar', async ({ page, isMobile }) => {
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Calendar' }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
})
