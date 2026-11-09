import { expect, test } from '@playwright/test'
import { toggleTheme } from './support/theme'

const KEY = 'dashboard_layout:1'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }))
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
})

const order = (page: import('@playwright/test').Page) =>
  page.locator('[data-widget]').evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')))

test('the new widgets are on the dashboard', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Current task' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
  await expect(page.locator('[data-widget="current-task"]')).toContainText('Module 6 · Go Basics')
})

test('default layout: current task and deadlines share a row, grades and activity share the next', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'desktop grid')
  const box = async (id: string) => (await page.locator(`[data-widget="${id}"]`).boundingBox())!
  const [task, deadlines, grades, activity] = [
    await box('current-task'),
    await box('deadlines'),
    await box('grades'),
    await box('activity'),
  ]
  expect(Math.abs(task.y - deadlines.y)).toBeLessThan(2)
  expect(deadlines.width).toBeGreaterThan(task.width * 1.7) // large (8) vs small (4)
  expect(Math.abs(grades.y - activity.y)).toBeLessThan(2)
  expect(grades.y).toBeGreaterThan(task.y)
})

test('widgets stack on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone only')
  const a = (await page.locator('[data-widget="current-task"]').boundingBox())!
  const b = (await page.locator('[data-widget="deadlines"]').boundingBox())!
  expect(b.y).toBeGreaterThan(a.y + a.height - 1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('edit mode: resize, reorder with buttons, remove and add back', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Edit dashboard' }).click()

  // width
  const grades = page.locator('[data-widget="grades"]')
  await expect(grades).toHaveClass(/widget--md/)
  const before = (await grades.boundingBox())!
  await page.getByRole('group', { name: 'Recent grades width' }).getByRole('button', { name: 'Large width' }).click()
  await expect(grades).toHaveClass(/widget--lg/)
  const after = (await grades.boundingBox())!
  if (!isMobile) expect(after.width).toBeGreaterThan(before.width) // phones stack everything full width anyway

  // order
  await page.getByRole('button', { name: 'Move Recent activity earlier' }).click()
  expect((await order(page)).slice(-2)).toEqual(['activity', 'grades'])

  // remove + add back
  await page.getByRole('button', { name: 'Remove Recent activity' }).click()
  await expect(page.locator('[data-widget="activity"]')).toHaveCount(0)
  await page.getByRole('button', { name: /^Add widget/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add Recent activity' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('[data-widget="activity"]')).toHaveCount(1)
  expect((await order(page)).at(-1)).toBe('activity')
})

test('the layout is remembered after a reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  await page.getByRole('button', { name: 'Remove Recent grades' }).click()
  await page.getByRole('button', { name: 'Move Recent activity earlier' }).click()
  const expected = await order(page)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()
  expect(await order(page)).toEqual(expected)
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).not.toBeNull()
})

test('Reset to default restores everything', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  await page.getByRole('button', { name: 'Remove Recent grades' }).click()
  await page.getByRole('button', { name: 'Reset to default' }).click()
  expect(await order(page)).toEqual(['progress', 'current-task', 'deadlines', 'grades', 'activity'])
})

test('dragging a widget by its handle reorders it (mouse)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse drag')
  await page.setViewportSize({ width: 1280, height: 2600 }) // tall, so both the handle and the target are on screen
  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  const handle = page.getByRole('button', { name: 'Drag Recent activity' })
  const target = (await page.locator('[data-widget="current-task"]').boundingBox())!
  const h = (await handle.boundingBox())!

  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(h.x + h.width / 2, h.y - 40, { steps: 5 })
  await page.mouse.move(target.x + target.width / 2, target.y + 20, { steps: 15 })
  await page.mouse.up()

  expect(await order(page)).toEqual(['progress', 'activity', 'current-task', 'deadlines', 'grades'])
})

test('edit mode keeps the page free of horizontal overflow, light and dark', async ({ page }) => {
  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await overflow()).toBe(false)
  await toggleTheme(page)
  expect(await overflow()).toBe(false)
})

test('the header chip returns on the dashboard once the Current task widget is removed', async ({ page, isMobile }) => {
  test.skip(isMobile, 'chip is hidden on small screens')
  await expect(page.getByRole('link', { name: /^Current module/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  await page.getByRole('button', { name: 'Remove Current task' }).click()
  await expect(page.getByRole('link', { name: /^Current module/ })).toBeVisible()
})
