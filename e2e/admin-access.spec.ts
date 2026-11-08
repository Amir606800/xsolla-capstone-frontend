import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openAdmin(page: Page, section: 'Students' | 'Mentors' | 'Lecturers') {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: section }).click()
  await expect(page.getByRole('table', { name: section })).toBeVisible()
}

async function signInToLms(page: Page, email: string, password: string) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.locator('button[type="submit"]').click()
}

test('after the admin resets a password, the old one stops working and the new one signs in', async ({ page }) => {
  await openAdmin(page, 'Students')
  await page.getByRole('button', { name: 'Reset the password of Sam Student' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('New password').fill('Back-To-Class-8')
  await dialog.getByRole('button', { name: 'Set new password' }).click()
  await expect(dialog.getByLabel('New password', { exact: true })).toHaveText('Back-To-Class-8')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('Sam Student has a new password.')).toBeVisible()

  await signInToLms(page, 'student@xsolla.school', 'secret')
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password')
  await page.getByLabel('Password', { exact: true }).fill('Back-To-Class-8')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('a lecturer given the mentor role keeps lecturing and gets the team pages too', async ({ page }) => {
  await openAdmin(page, 'Lecturers')
  await page.getByRole('button', { name: 'Roles of Elvin Huseynov' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('group', { name: 'Main role' })).toContainText('Lecturer')
  await dialog.getByRole('radio', { name: 'Mentor, no end date' }).check()
  await dialog.getByRole('button', { name: 'Save roles' }).click()
  await expect(page.getByText('Elvin Huseynov: Lecturer, and mentor. Give them a team on the Mentors page.')).toBeVisible()

  // now listed on the Mentors page as well
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Mentors' }).click()
  await expect(page.getByRole('row', { name: /Elvin Huseynov/ })).toContainText('+ Mentor')

  await signInToLms(page, 'teacher@xsolla.school', 'secret')
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Course content' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'My team' })).toBeVisible()
})

test('the reset dialog and the roles dialog fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openAdmin(page, 'Lecturers')
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  await page.getByRole('button', { name: 'Reset the password of Elvin Huseynov' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Generate' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Set new password' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Roles of Elvin Huseynov' }).click()
  await page.getByRole('dialog').getByRole('radio', { name: /^Mentor for a while/ }).check()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Save roles' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
