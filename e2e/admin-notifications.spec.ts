import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openNotifications(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Notifications' }).click()
  await expect(page.getByRole('form', { name: 'New announcement' })).toBeVisible()
}

test('an announcement the admin sends shows in the bell of the people it is for', async ({ page }) => {
  await openNotifications(page)
  await page.getByRole('textbox', { name: 'Message' }).fill('No classes on Friday.')
  await page.getByRole('radio', { name: /^Students/ }).check()
  await page.getByRole('button', { name: 'Send announcement' }).click()
  await expect(page.getByRole('dialog')).toContainText('It goes to 29 people and cannot be taken back.')
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Sent to 29 people (students).')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Sent announcements' })).toContainText('No classes on Friday.')

  // a student signs in (same browser, offline demo)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill('student@xsolla.school')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.locator('button[type="submit"]').click()
  await page.getByRole('button', { name: /^Notifications/ }).click()
  await expect(page.getByRole('dialog')).toContainText('No classes on Friday.')
})

test('a message for everyone also reaches a lecturer, who has no other notifications', async ({ page }) => {
  await openNotifications(page)
  await page.getByRole('textbox', { name: 'Message' }).fill('Welcome to the new week')
  await page.getByRole('button', { name: 'Send announcement' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(/^Sent to 37 people/)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill('teacher@xsolla.school')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.locator('button[type="submit"]').click()
  await expect(page.getByRole('button', { name: 'Notifications, 1 unread' })).toBeVisible()
})

test('the notifications page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openNotifications(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
