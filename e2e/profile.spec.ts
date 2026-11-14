import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const ADMIN = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }

const signInAs = (page: Page, user: object) => page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('clicking the name in the top right opens the profile; the look settings apply at once and survive a reload', async ({ page }) => {
  await signInAs(page, STUDENT)
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Sam Student profile' }).click()
  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile', level: 1 })).toBeVisible()

  const size = async () => (await page.locator('.page-title').boundingBox())!.height
  const before = await size()
  await page.getByRole('radio', { name: 'Extra large' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xlarge')
  expect(await size()).toBeGreaterThan(before)

  await page.getByRole('checkbox', { name: /High contrast/ }).check()
  await page.getByRole('radio', { name: 'Dark' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-text', 'xlarge')
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

for (const width of [320, 390]) {
  test(`the profile fits a ${width}px phone, also with the biggest text`, async ({ page }) => {
    await signInAs(page, STUDENT)
    await page.addInitScript(() => localStorage.setItem('look', JSON.stringify({ textSize: 'xlarge', spacing: 'relaxed', font: 'dyslexia' })))
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/profile')
    await expect(page.getByRole('heading', { name: 'About me' })).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
}

test('the admin reaches the profile from their name in the bar', async ({ page }) => {
  await signInAs(page, ADMIN)
  await page.goto('/admin')
  await page.getByRole('link', { name: 'School Admin profile' }).click()
  await expect(page).toHaveURL(/\/admin\/profile$/)
  await expect(page.getByRole('heading', { name: 'Look and accessibility' })).toBeVisible()
})
