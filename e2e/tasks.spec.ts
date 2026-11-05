import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }))
  })
  await page.goto('/tasks')
  await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible()
})

const rows = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Tasks' }).locator('li.assignment')
const filter = (page: import('@playwright/test').Page, name: RegExp) =>
  page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name })

/** The number on a filter button, e.g. the 3 in "To do 3". */
const badge = async (page: import('@playwright/test').Page, name: RegExp) =>
  Number(await filter(page, name).locator('.tasks__count').innerText())

test('opens from the sidebar', async ({ page, isMobile }) => {
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'Tasks' }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tasks' })).toHaveClass(/is-active/)
})

test('lists tasks from the open modules only, overdue first', async ({ page }) => {
  await expect(rows(page).first()).toBeVisible()
  await expect(rows(page).first()).toContainText('Overdue')
  await expect(page.getByRole('region', { name: 'Tasks' })).not.toContainText(/Schema design|Docker/)
  await expect(page.getByRole('combobox')).toContainText('Module 6')
  await expect(page.getByRole('combobox')).not.toContainText('Module 7')
})

test('filters by status and keeps it in the address', async ({ page }) => {
  const n = await badge(page, /^Graded/)
  expect(n).toBeGreaterThan(0)
  await filter(page, /^Graded/).click()
  await expect(page).toHaveURL(/status=graded/)
  await expect(rows(page)).toHaveCount(n)
  for (let i = 0; i < n; i++) await expect(rows(page).nth(i)).toContainText('Graded')

  await filter(page, /^All/).click()
  await expect(page).not.toHaveURL(/status=/)
})

test('filters by module', async ({ page }) => {
  const all = await badge(page, /^All/)
  await page.getByRole('combobox').selectOption('m6')
  await expect(page).toHaveURL(/module=m6/)
  await expect.poll(() => badge(page, /^All/)).toBeLessThan(all) // the counts follow the module
  const n = await badge(page, /^All/)
  expect(n).toBeGreaterThan(0)
  await expect(rows(page)).toHaveCount(n)
  for (let i = 0; i < n; i++) await expect(rows(page).nth(i)).toContainText('Module 6')
})

test('a link with a filter opens that view, and survives a reload', async ({ page }) => {
  await page.goto('/tasks?status=overdue')
  await expect(filter(page, /^Overdue/)).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(filter(page, /^Overdue/)).toHaveAttribute('aria-pressed', 'true')
  await expect(rows(page).first()).toContainText('Overdue')
})

test('hands in a task from this page and it leaves the To do list', async ({ page }) => {
  const before = await badge(page, /^To do/)
  expect(before).toBeGreaterThan(0)
  await filter(page, /^To do/).click()
  await expect(rows(page)).toHaveCount(before)

  const first = rows(page).first()
  await first.getByRole('button').first().click()
  await first.getByLabel('Answer or link').fill('https://github.com/team/repo')
  await first.getByRole('button', { name: 'Submit' }).click()

  await expect(rows(page)).toHaveCount(before - 1)
  await filter(page, /^Submitted/).click()
  await expect(rows(page).first()).toBeVisible()
})

test('works in dark theme and has no horizontal overflow', async ({ page }) => {
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await overflow()).toBe(false)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await overflow()).toBe(false)
  await rows(page).first().getByRole('button').first().click() // expanded task fits too
  expect(await overflow()).toBe(false)
})

test('filters and the module picker fit the screen', async ({ page }) => {
  const vp = page.viewportSize()!
  const group = (await page.getByRole('group', { name: 'Filter by status' }).boundingBox())!
  const select = (await page.getByRole('combobox').boundingBox())!
  for (const box of [group, select]) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  }
})
