import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openLecturers(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Lecturers' }).click()
  await expect(page.getByRole('table', { name: 'Lecturers' })).toBeVisible()
}

test('the admin adds a lecturer, who signs in and gets the lecturer pages', async ({ page }) => {
  await openLecturers(page)
  await page.getByRole('button', { name: 'Add lecturer' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Full name').fill('Lea Lecturer')
  await form.getByLabel('Email').fill('lea@example.com')
  await form.getByLabel('Password', { exact: true }).fill('secret123')
  await form.getByRole('button', { name: 'Add lecturer' }).click()
  await expect(page.getByText(/^Lea Lecturer added as a lecturer\./)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill('lea@example.com')
  await page.getByLabel('Password', { exact: true }).fill('secret123')
  await page.locator('button[type="submit"]').click()
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Course content' })).toBeVisible()
  // a lecturer without the mentor role has no team page
  await expect(nav.getByRole('link', { name: 'My team' })).toHaveCount(0)
})

test('a mentor given the lecturer role for a week appears here with the days left', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Mentors' }).click()
  await page.getByRole('button', { name: 'Roles of Aysel Mammadova' }).click()
  await page.getByRole('dialog').getByRole('radio', { name: /^Lecturer for a while/ }).check()
  await page.getByRole('dialog').getByRole('button', { name: '1 week' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save roles' }).click()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Lecturers' }).click()
  await expect(page.getByRole('row', { name: /Aysel Mammadova/ })).toContainText('7 days left')
})

test('the admin gives a week to a lecturer, and the Modules page shows them', async ({ page }) => {
  await openLecturers(page)
  await expect(page.getByRole('row', { name: /Nargiz Abbasova/ })).toContainText('—')
  await page.getByRole('button', { name: 'Assign weeks to Nargiz Abbasova' }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: /^Week 3 · / }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Assign 1 week' }).click()
  await expect(page.getByText('Nargiz Abbasova now teaches week 3.')).toBeVisible()
  await expect(page.getByRole('row', { name: /Nargiz Abbasova/ })).toContainText('Week 3')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Modules' }).click()
  await expect(page.getByRole('row', { name: /JavaScript/ })).toContainText('Nargiz Abbasova')
})

test('the lecturers page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openLecturers(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
