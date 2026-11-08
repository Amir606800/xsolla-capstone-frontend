import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openMentors(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Mentors' }).click()
  await expect(page.getByRole('table', { name: 'Mentors' })).toBeVisible()
}

test('a lecturer role given to a mentor for a week shows in the LMS when they sign in', async ({ page }) => {
  await openMentors(page)
  await page.getByRole('button', { name: 'Roles of Aysel Mammadova' }).click()
  const form = page.getByRole('dialog')
  await form.getByRole('radio', { name: /^Lecturer for a while/ }).check()
  await form.getByRole('button', { name: '1 week' }).click()
  await form.getByRole('button', { name: 'Save roles' }).click()
  await expect(page.getByText(/^Aysel Mammadova: Mentor, and lecturer until /)).toBeVisible()
  await expect(page.getByRole('row', { name: /Aysel Mammadova/ })).toContainText('7 days left')

  // Aysel signs in to the LMS (same browser, offline demo)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill('mentor@xsolla.school')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.locator('button[type="submit"]').click()
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Course content' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'My team' })).toBeVisible()
})

test('the admin adds a mentor for a team without one', async ({ page }) => {
  await openMentors(page)
  // free Team 6 first
  await page.getByRole('button', { name: 'Edit Sevinj Gasimova' }).click()
  await page.getByRole('dialog').getByLabel('Team they mentor').selectOption({ label: 'No team yet' })
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('note')).toContainText('Team 6 has no mentor.')

  await page.getByRole('button', { name: 'Add mentor' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Full name').fill('Nil Aydin')
  await form.getByLabel('Email').fill('nil@example.com')
  await form.getByRole('button', { name: 'Generate' }).click()
  await form.getByLabel('Team they mentor').selectOption({ label: 'Team 6 (no mentor)' })
  await form.getByRole('button', { name: 'Add mentor' }).click()
  await expect(page.getByText(/^Nil Aydin added as a mentor of Team 6\./)).toBeVisible()
  await expect(page.getByRole('note')).toHaveCount(0)
})

test('the mentors page and the roles form fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openMentors(page)
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Roles of Rashad Aliyev' }).click()
  await page.getByRole('dialog').getByRole('radio', { name: /^Lecturer for a while/ }).check()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Save roles' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
