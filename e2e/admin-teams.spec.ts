import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
}
async function openTeams(page: Page) {
  await signIn(page)
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Teams' }).click()
  await expect(page.getByRole('region', { name: 'Team 1' })).toBeVisible()
}

test('the admin moves a student between teams', async ({ page }) => {
  await openTeams(page)
  await page.getByRole('combobox', { name: 'Move Sam Student to another team' }).selectOption({ label: 'Team 1' })
  await expect(page.getByText(/^Sam Student moved from Team 3 to Team 1\./)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Team 1' })).toContainText('Sam Student')
})

test('with no teams only the creator shows; random teams are created from a preview', async ({ page }) => {
  await openTeams(page)
  await page.getByRole('button', { name: 'Remove all teams…' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove all teams' }).click()
  await expect(page.getByRole('heading', { name: 'There are no teams yet' })).toBeVisible()
  await expect(page.getByRole('region', { name: /^Team \d/ })).toHaveCount(0)

  await expect(page.getByRole('list', { name: 'Preview' }).getByRole('listitem')).toHaveCount(6)
  await page.getByRole('button', { name: 'Create these teams' }).click()
  await expect(page.getByText('6 teams created.')).toBeVisible()
  await expect(page.getByRole('region', { name: /^Team \d/ })).toHaveCount(6)

  // still there after a reload (the offline demo keeps it in this browser)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Team 6' })).toBeVisible()
})

test('modals fit their content: a question is narrow, details are wide', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openTeams(page)
  await page.getByRole('button', { name: 'Remove all teams…' }).click()
  const question = (await page.getByRole('dialog').boundingBox())!
  expect(question.width).toBeLessThanOrEqual(430)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await page.goto('/admin/modules/m5')
  await page.getByRole('button', { name: 'View Hooks basics' }).click()
  const details = (await page.getByRole('dialog').boundingBox())!
  expect(details.width).toBeGreaterThanOrEqual(700)
})

test('the teams page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openTeams(page)
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(await overflow()).toBeLessThanOrEqual(0)
  await page.getByRole('button', { name: 'Create random teams…' }).click()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Replace teams' })).toBeVisible()
  expect(await overflow()).toBeLessThanOrEqual(0)
})
