import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const STUDENT = { id: 1, name: 'Sam Student With A Very Long Name', email: 'student@xsolla.school', roles: ['student'] }
const STAFF = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', roles: ['mentor', 'lecturer'] }

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

for (const width of [320, 360, 390]) {
  for (const [label, user] of [['student', STUDENT], ['staff', STAFF]] as const) {
    test(`the header fits a ${width}px phone, for a ${label}`, async ({ page }) => {
      await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/dashboard')
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      // nothing in the header is cut off on the right
      const header = (await page.locator('header.header').boundingBox())!
      const account = (await page.getByRole('button', { name: 'Account menu' }).boundingBox())!
      expect(account.x + account.width).toBeLessThanOrEqual(header.x + header.width + 1)
      // the open menu stays on screen
      await page.getByRole('button', { name: 'Account menu' }).click()
      const menu = (await page.getByRole('menu').boundingBox())!
      expect(menu.x).toBeGreaterThanOrEqual(0)
      expect(menu.x + menu.width).toBeLessThanOrEqual(width)
      expect(await overflow(page)).toBeLessThanOrEqual(0)
    })
  }
}

test('the theme switch is in the account menu: it changes the theme, closes the menu and the choice stays', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), STUDENT)
  await page.goto('/dashboard')
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toHaveCount(0) // no loose button in the bar
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await expect(page.getByRole('menuitem', { name: 'Light mode' })).toBeVisible()
})
