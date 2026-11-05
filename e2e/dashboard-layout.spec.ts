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

test('shows header, sidebar and main section', async ({ page, isMobile }) => {
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Welcome, Sam' })).toBeVisible()

  if (isMobile) {
    // sidebar is a hidden drawer on small screens
    await page.getByRole('button', { name: 'Open navigation' }).click()
  }
  await expect(page.getByRole('link', { name: 'My courses' })).toBeVisible()
})

test('sidebar navigation changes route', async ({ page, isMobile }) => {
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: 'My grades' }).click()
  await expect(page).toHaveURL(/\/grades$/)
  await expect(page.getByRole('heading', { name: 'My grades', level: 1 })).toBeVisible()
})

test('no horizontal overflow', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('mobile drawer opens and closes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'drawer only exists on small screens')
  const drawer = page.getByRole('complementary', { name: 'Sidebar' })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(drawer).toHaveClass(/is-open/)
  await page.getByRole('button', { name: 'Close navigation' }).click()
  await expect(drawer).not.toHaveClass(/is-open/)
})
