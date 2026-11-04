import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
    )
  })
  await page.goto('/dashboard')
})

const bell = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Notifications/ })

test('the bell shows how many notifications are unread', async ({ page }) => {
  await expect(bell(page)).toHaveAccessibleName('Notifications, 4 unread')
  await expect(page.locator('.bell__badge')).toHaveText('4')
})

test('opens a modal listing the notifications, unread ones highlighted', async ({ page }) => {
  await bell(page).click()
  const dialog = page.getByRole('dialog', { name: 'Notifications' })
  await expect(dialog).toBeVisible()
  const rows = dialog.getByRole('list', { name: 'Notifications' }).getByRole('listitem')
  await expect(rows).toHaveCount(8)
  await expect(dialog.locator('.notif.is-unread')).toHaveCount(4)
  await expect(rows.first()).toContainText('ago')
})

test('the Unread filter narrows the list', async ({ page }) => {
  await bell(page).click()
  const dialog = page.getByRole('dialog', { name: 'Notifications' })
  await dialog.getByRole('button', { name: /^Unread/ }).click()
  await expect(dialog.getByRole('list', { name: 'Notifications' }).getByRole('listitem')).toHaveCount(4)
  await dialog.getByRole('button', { name: 'All', exact: true }).click()
  await expect(dialog.getByRole('list', { name: 'Notifications' }).getByRole('listitem')).toHaveCount(8)
})

test('clicking a notification opens the related page, closes the modal and lowers the count', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('dialog').getByRole('link', { name: /1:1 with your mentor/ }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(bell(page)).toHaveAccessibleName('Notifications, 3 unread')
})

test('"Mark all as read" removes the badge', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('button', { name: /Mark all as read/ }).click()
  await expect(page.getByRole('dialog').locator('.notif.is-unread')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Mark all as read/ })).toBeDisabled()
  await expect(page.locator('.bell__badge')).toHaveCount(0)
})

test('closes with Escape and returns focus to the bell', async ({ page }) => {
  await bell(page).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(bell(page)).toBeFocused()
})

test('the modal fits the screen in light and dark, on desktop and phone', async ({ page }) => {
  await bell(page).click()
  const vp = page.viewportSize()!
  const fits = async () => {
    const box = (await page.locator('.modal').boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  }
  await fits()

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await bell(page).click()
  await fits()
})

test('the list scrolls inside the modal while the page behind stays put', async ({ page }) => {
  await bell(page).click()
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
