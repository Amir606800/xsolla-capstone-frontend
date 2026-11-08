import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function openStudents(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Students' }).click()
  await expect(page.getByRole('table', { name: 'Students' })).toBeVisible()
}

test('the admin adds a student to a team, and finds them with the search', async ({ page }) => {
  await openStudents(page)
  await page.getByRole('button', { name: 'Add student' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Full name').fill('Ann Lee')
  await form.getByLabel('Email').fill('ann.lee@example.com')
  await form.getByRole('button', { name: 'Generate' }).click()
  await form.getByLabel('Team').selectOption({ label: 'Team 6 (4 students)' })
  await form.getByRole('button', { name: 'Add student' }).click()
  await expect(page.getByText(/^Ann Lee added to Team 6\./)).toBeVisible()

  await page.reload()
  await page.getByRole('searchbox', { name: 'Search students' }).fill('ann.lee')
  const rows = page.getByRole('table', { name: 'Students' }).getByRole('row')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(1)).toContainText('Team 6')
})

test('the students page and the add form fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openStudents(page)
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Add student' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Add student' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})

test('a student who left the school moves to that list and can be brought back', async ({ page }) => {
  await openStudents(page)
  await page.getByRole('button', { name: 'Tural Karimov left the school' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Mark as left' }).click()
  await expect(page.getByText('Tural Karimov is marked as left the school.')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Tural Karimov', exact: true })).toHaveCount(0)

  await page.reload()
  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: /^Left the school/ }).click()
  await expect(page.getByRole('cell', { name: 'Tural Karimov', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Bring back Tural Karimov' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Bring back' }).click()
  await expect(page.getByText('Tural Karimov is back. Put them in a team with Edit.')).toBeVisible()
})

test('the row buttons sit side by side, so rows stay one line tall', async ({ page }) => {
  await openStudents(page)
  const buttons = page.getByRole('table', { name: 'Students' }).getByRole('row').nth(1).getByRole('button')
  const boxes = await Promise.all([0, 1, 2].map(async (i) => (await buttons.nth(i).boundingBox())!))
  for (const b of boxes) expect(Math.abs(b.y - boxes[0].y)).toBeLessThan(2)
})

test('a made-up name, e-mail or weak password cannot be used for an account', async ({ page }) => {
  await openStudents(page)
  await page.getByRole('button', { name: 'Add student' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Full name').fill('asdf')
  await form.getByLabel('Email').fill('asdf@asdf')
  await form.getByLabel('Password', { exact: true }).fill('12345678')
  await form.getByRole('button', { name: 'Add student' }).click()
  await expect(form.getByText('Enter their first and last name.')).toBeVisible()
  await expect(form.getByText('Enter a real e-mail address, like name@example.com.')).toBeVisible()
  await expect(form.getByText('Use 10 to 72 characters.')).toBeVisible()
  await expect(form).toBeVisible() // nothing was created

  await form.getByLabel('Full name').fill('Ann Lee')
  await form.getByLabel('Email').fill('ann.lee@example.com')
  await form.getByLabel('Password', { exact: true }).fill('Tq7mWz4kPd')
  await form.getByRole('button', { name: 'Add student' }).click()
  await expect(page.getByText(/^Ann Lee added/)).toBeVisible()
})
