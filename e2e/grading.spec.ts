import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const RASHAD = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', roles: ['mentor', 'lecturer'] }
const SAM = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** Same browser storage = same mock backend, so the two people see each other's changes. */
async function signInAs(page: Page, user: typeof RASHAD | typeof SAM) {
  await page.evaluate((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
}

test("the mentor's week grade and note reach the student's My grades", async ({ page }) => {
  await page.goto('/login')
  await signInAs(page, RASHAD)
  await page.goto('/grading?week=m5')
  await page.getByRole('button', { name: "Change Sam Student's week 5" }).click()
  await page.getByRole('radio', { name: /On track/ }).check({ force: true })
  await page.getByLabel('Note for Sam Student (optional)').fill('Strong finish to the React week.')
  await page.getByRole('button', { name: 'Save week grade' }).click()
  await expect(page.getByRole('status')).toContainText('Sam Student: week 5 graded on track.')

  await signInAs(page, SAM)
  await page.goto('/grades')
  await expect(page.getByText('Strong finish to the React week.')).toBeVisible()
})

test('a student hands in work, the mentor comments, the student reads it and can still hand in again', async ({ page }) => {
  await page.goto('/login')
  await signInAs(page, SAM)
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()
  await page.getByLabel(/Answer or link/).fill('https://github.com/sam/http-server')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByText('Your work was submitted.')).toBeVisible()

  await signInAs(page, RASHAD)
  await page.goto('/grading?week=m6')
  await page.getByRole('button', { name: "Open Sam Student's HTTP server" }).click()
  await expect(page.getByText('https://github.com/sam/http-server')).toBeVisible()
  await page.getByLabel('Comment for Sam Student').fill('Add a test for the 404 route.')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByRole('status')).toContainText('Comment saved')

  await signInAs(page, SAM)
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()
  await expect(page.getByText('Comment from your mentor')).toBeVisible()
  await expect(page.getByText('Add a test for the 404 route.')).toBeVisible()
  // a comment is not a grade: the task stays open
  await expect(page.getByRole('button', { name: 'Resubmit' })).toBeVisible()
})

test('the dashboard links straight to a week grade still to give', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), RASHAD)
  await page.goto('/dashboard')
  const first = page.getByRole('list', { name: 'Week grades to give' }).getByRole('link').first()
  const name = (await first.locator('.list__title').textContent())!.trim()
  await first.click()
  await expect(page).toHaveURL(/\/grading\?week=m5&grade=\d+/)
  await expect(page.getByRole('group', { name: `Week 5 grade for ${name}` })).toBeVisible()
})

test('the grading page fits the screen in light and dark', async ({ page }) => {
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), RASHAD)
  await page.goto('/grading?week=m5&grade=101&open=m5-a1~101')
  await expect(page.getByRole('group', { name: 'Week 5 grade for Leyla Hasanova' })).toBeVisible()
  expect(await overflow(page)).toBe(false)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  expect(await overflow(page)).toBe(false)
})
