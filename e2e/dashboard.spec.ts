import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
    )
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
})

test('shows score, stats, 12 modules, deadlines and grades', async ({ page }) => {
  await expect(page.getByText('My score')).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Modules' })).toBeVisible()
  await expect(page.getByRole('progressbar', { name: 'Tasks' })).toBeVisible()
  await expect(page.getByText('Coming soon')).toBeVisible() // quiz slot
  // modules 1-6 are open (links); modules 7-12 are locked for a student
  await expect(page.getByRole('link', { name: /^Module \d+:/ })).toHaveCount(6)
  await expect(page.locator('.node--locked')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Upcoming deadlines' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent grades' })).toBeVisible()
})

test('clicking a module opens its page', async ({ page }) => {
  await page.getByRole('link', { name: /^Module 1:/ }).click()
  await expect(page).toHaveURL(/\/courses\/m1$/)
})

test('path layout follows the viewport (snake on wide, timeline on narrow)', async ({ page, isMobile }) => {
  const box = async (n: number) =>
    (await page.getByLabel(new RegExp(`^Module ${n}:`)).boundingBox())!

  const [m1, m2, m4, m5, m8] = [await box(1), await box(2), await box(4), await box(5), await box(8)]

  if (isMobile) {
    // vertical timeline: stacked, same x
    expect(m2.y).toBeGreaterThan(m1.y + m1.height - 1)
    expect(Math.abs(m2.x - m1.x)).toBeLessThan(2)
  } else {
    // snake: row 1 left->right on one line, row 2 starts under module 4 and runs right->left
    expect(Math.abs(m1.y - m4.y)).toBeLessThan(2)
    expect(m2.x).toBeGreaterThan(m1.x)
    expect(m5.y).toBeGreaterThan(m4.y)
    expect(Math.abs(m5.x - m4.x)).toBeLessThan(4) // same column (sub-pixel text widths differ per font)
    expect(m8.x).toBeLessThan(m5.x)
  }
})

test('no horizontal overflow with dashboard content', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('works in dark theme', async ({ page }) => {
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('link', { name: /^Module 1:/ })).toBeVisible()
})

test('module data is fetched once while moving between pages', async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Tasks' }).click()
  await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible()
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  // shared context: content is there immediately, no loading flash
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
})


test('the current module shows Opened / Due badges on both sides and the time left', async ({ page }) => {
  const current = page.locator('.node--active')
  await expect(current).toHaveCount(1)
  await expect(current).toHaveAttribute('aria-current', 'step')
  await expect(current.locator('.node__tag--left')).toContainText('Opened')
  await expect(current.locator('.node__tag--right')).toContainText('Due')
  await expect(current.locator('.node__tag-time')).toHaveText(/^\d\d:\d\d$/)
  await expect(current.locator('.node__when')).toHaveText(/^in \d+ (days?|hours?)$/)
})

test('the badges sit on opposite sides of the circle and stay inside the card', async ({ page }) => {
  const circle = (await page.locator('.node--active .node__circle').boundingBox())!
  const left = (await page.locator('.node__tag--left').boundingBox())!
  const right = (await page.locator('.node__tag--right').boundingBox())!
  const card = (await page.locator('.card--progress').boundingBox())!

  expect(left.x + left.width / 2).toBeLessThan(circle.x + circle.width / 2)
  expect(right.x + right.width / 2).toBeGreaterThan(circle.x + circle.width / 2)
  expect(left.x).toBeGreaterThanOrEqual(card.x)
  expect(right.x + right.width).toBeLessThanOrEqual(card.x + card.width)
})

test('upcoming deadlines show the exact time', async ({ page }) => {
  const rows = page.getByRole('heading', { name: 'Upcoming deadlines' }).locator('xpath=ancestor::section[1]').getByRole('listitem')
  await expect(rows.first()).toContainText(/\d\d:\d\d/)
})
