import { expect, test } from '@playwright/test'
import { toggleTheme } from './support/theme'

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

test('clicking a notification asks before leaving the page', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('dialog').getByRole('link', { name: /1:1 with your mentor/ }).click()

  // nothing happened yet: same page, the question is shown
  await expect(page).toHaveURL(/\/dashboard$/)
  const question = page.getByRole('region', { name: 'Open this notification?' })
  await expect(question).toBeVisible()
  await expect(question).toContainText('the Calendar')
  await expect(question.getByRole('button', { name: 'Stay here' })).toBeFocused()

  await question.getByRole('button', { name: 'Stay here' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(bell(page)).toHaveAccessibleName('Notifications, 4 unread')
})

test('confirming opens the page, closes the modal and lowers the unread count', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('dialog').getByRole('link', { name: /1:1 with your mentor/ }).click()
  await page.getByRole('button', { name: 'Open page' }).click()

  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(bell(page)).toHaveAccessibleName('Notifications, 3 unread')
})

test('"Don\'t ask me again" is remembered across reloads', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('dialog').getByRole('link', { name: /1:1 with your mentor/ }).click()
  await page.getByRole('checkbox', { name: "Don't ask me again" }).check()
  await page.getByRole('button', { name: 'Open page' }).click()
  await expect(page).toHaveURL(/\/calendar$/)

  await page.goto('/dashboard') // fresh load
  await bell(page).click()
  await page.getByRole('dialog').getByRole('link', { name: /HTTP server/ }).click()
  await expect(page).toHaveURL(/\/courses\/m6$/) // no question this time
  await expect(page.getByRole('region', { name: 'Open this notification?' })).toHaveCount(0)
})

test('the question can be switched back on from the modal', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('notif_confirm', 'skip'))
  await page.goto('/dashboard')
  await bell(page).click()
  await page.getByRole('checkbox', { name: 'Ask before opening a notification' }).check()
  await page.getByRole('dialog').getByRole('link', { name: /1:1 with your mentor/ }).click()
  await expect(page.getByRole('region', { name: 'Open this notification?' })).toBeVisible()
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
  await toggleTheme(page)
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

test('the whole modal, including its footer setting, is reachable on screen', async ({ page }) => {
  await bell(page).click()
  await page.getByRole('checkbox', { name: 'Ask before opening a notification' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('checkbox', { name: 'Ask before opening a notification' })).toBeInViewport()
  const box = (await page.locator('.modal').boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
})
