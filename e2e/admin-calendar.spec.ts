import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openCalendar(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Calendar' }).click()
  await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Month view' })).toBeVisible()
}

test('the admin adds an event, postpones it by a week, then deletes it', async ({ page }) => {
  await openCalendar(page)
  await page.getByRole('button', { name: /^Add an event/ }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title').fill('Guest talk')
  await form.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByText('Event added.')).toBeVisible()

  await page.getByRole('button', { name: /^Postpone Guest talk on / }).click()
  await page.getByRole('dialog').getByRole('button', { name: '+1 week' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Postpone' }).click()
  await expect(page.getByText(/^“Guest talk” moved to /)).toBeVisible()

  // the list now shows the day it moved to; delete it from there
  await page.getByRole('button', { name: /^Delete Guest talk on / }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete event' }).click()
  await expect(page.getByText('“Guest talk” deleted.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Delete Guest talk on / })).toHaveCount(0)
})

test('the calendar page fits a phone screen and a wide one', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openCalendar(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // on a wide screen the list sits beside the month
  await page.setViewportSize({ width: 1440, height: 900 })
  const month = (await page.getByRole('group', { name: 'Month view' }).boundingBox())!
  const list = (await page.locator('.admin-cal__list').boundingBox())!
  expect(list.x).toBeGreaterThan(month.x + month.width - 1)
})
