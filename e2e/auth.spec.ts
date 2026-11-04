import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.getByLabel('Email').fill('sam@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.locator('button[type="submit"]').click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
})

test('guests are redirected to /login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('renders the split layout with branding and card', async ({ page }) => {
  await expect(page.getByText('XSOLLA', { exact: true })).toBeVisible()
  await expect(page.getByText('SCHOOL BAKU')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Sign in' })).toHaveAttribute('aria-selected', 'true')
})

test('sign in button enables only with valid input', async ({ page }) => {
  const submit = page.locator('button[type="submit"]')
  await expect(submit).toBeDisabled()
  await page.getByLabel('Email').fill('me@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await expect(submit).toBeEnabled()
})

test('sign up flow validates name and confirmation', async ({ page }) => {
  await page.getByRole('tab', { name: 'Sign up' }).click()
  const submit = page.locator('button[type="submit"]')
  await page.getByLabel('Name').fill('Sam')
  await page.getByLabel('Email').fill('me@example.com')
  await page.getByLabel('Password', { exact: true }).fill('longenough1')
  await page.getByLabel('Confirm password').fill('nope')
  await expect(submit).toBeDisabled()
  await page.getByLabel('Confirm password').fill('longenough1')
  await expect(submit).toBeEnabled()
})

test('password visibility toggle', async ({ page }) => {
  const pw = page.getByLabel('Password', { exact: true })
  await expect(pw).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(pw).toHaveAttribute('type', 'text')
})

test('theme toggle switches colours and persists across reload', async ({ page }) => {
  const card = page.locator('.auth__card')
  const before = await card.evaluate((el) => getComputedStyle(el).backgroundColor)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  const after = await card.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(after).not.toBe(before)

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('page has no horizontal overflow and card is visible', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
  await expect(page.locator('.auth__card')).toBeVisible()
})

test('sign in leads to the dashboard and the session survives a reload', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Welcome, Sam' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome, Sam' })).toBeVisible()

  // signed-in users skip the login page
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('log out returns to login and blocks the dashboard', async ({ page }) => {
  await signIn(page)
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})
