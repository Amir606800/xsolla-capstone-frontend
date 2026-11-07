import { expect, test } from '@playwright/test'

test('the admin signs in on their own page and lands in the admin section', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: 'Sign in to the admin panel' })).toBeVisible()

  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  // the LMS pages are not for admins
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/admin$/)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('a student account is refused on the admin sign-in', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill('student@xsolla.school')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('This account does not have admin access')
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('the dashboard: sidebar sections and the overview tiles lead to each section', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()

  const tiles = page.getByRole('list', { name: 'School at a glance' })
  await expect(tiles.getByRole('link', { name: /^Students/ })).toContainText('29')
  await tiles.getByRole('link', { name: /^Teams/ }).click()
  await expect(page).toHaveURL(/\/admin\/teams$/)
  await expect(page.getByRole('heading', { name: 'Teams', level: 1 })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Admin sections' })
  await nav.getByRole('link', { name: 'Calendar' }).click()
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await nav.getByRole('link', { name: 'Overview' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('the dashboard fits a phone screen, in light and dark', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('list', { name: 'School at a glance' })).toBeVisible()
  for (let i = 0; i < 2; i++) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Toggle theme' }).click()
  }
  // the section list scrolls sideways instead of pushing the page wider
  await expect(page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Notifications' })).toBeAttached()
})

test('the admin sign-in fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/admin/login')
  const card = page.locator('.admin-auth__card')
  await expect(card).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
