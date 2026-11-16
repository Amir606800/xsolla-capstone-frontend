import { expect, test } from '@playwright/test'

async function signInAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('analytics: the overview shows weekly standing and a week without grades', async ({ page }) => {
  await signInAsAdmin(page)
  const nav = page.getByRole('navigation', { name: 'Admin sections' })
  // the menu folds when it does not fit: open the group first if its heading is a button
  const insights = nav.getByRole('button', { name: 'Insights' })
  if (await insights.count()) await insights.click()
  await nav.getByRole('link', { name: 'Analytics' }).click()

  await expect(page).toHaveURL(/\/admin\/analytics$/)
  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible()
  const table = page.getByRole('table', { name: 'Weekly student standing' })
  await expect(table).toBeVisible()
  await expect(table.getByText('No grades recorded')).toBeVisible()
  const legend = page.getByRole('list', { name: 'Weekly student standing legend' })
  await expect(legend).toContainText('Green')
  await expect(legend).toContainText('Yellow')
  await expect(legend).toContainText('Red')
})

test('analytics: find a student and read their submission and quiz charts', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/analytics/students')

  await page.getByRole('searchbox', { name: 'Search students' }).fill('Leyla')
  await page.getByRole('link', { name: /Leyla Hasanova/ }).click()

  await expect(page.getByRole('heading', { name: 'Leyla Hasanova', level: 1 })).toBeVisible()
  await expect(page.getByRole('table', { name: /Assignment submission status/ })).toBeVisible()
  const accuracy = page.getByRole('table', { name: 'Quiz accuracy by module' })
  await expect(accuracy).toContainText('80%')
  await expect(accuracy).toContainText('No scored answers')
})

test('analytics: a mentor with no ratings says so, and the roster caveat is shown', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/analytics/mentors/902')

  await expect(page.getByRole('heading', { name: 'Elvin Huseynov', level: 1 })).toBeVisible()
  const feedback = page.getByRole('table', { name: 'Student feedback by dimension' })
  await expect(feedback.getByText('No responses').first()).toBeVisible()
  await expect(page.getByText(/Uses the mentor's current team/)).toBeVisible()
  await expect(page.getByRole('table', { name: "The mentor's students by week" })).toBeVisible()
})

test('analytics is not reachable without signing in to the admin section', async ({ page }) => {
  await page.goto('/admin/analytics')
  await expect(page).toHaveURL(/\/admin\/login$/)
})
