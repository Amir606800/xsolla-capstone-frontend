import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
    )
  })
})

async function openSidebar(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
}

test('My courses lists 12 modules and opens one', async ({ page, isMobile }) => {
  await page.goto('/dashboard')
  await openSidebar(page, isMobile)
  await page.getByRole('link', { name: 'My courses' }).click()
  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByRole('list', { name: 'Modules' }).getByRole('link')).toHaveCount(12)

  await page.getByRole('link', { name: /Module 6/ }).click()
  await expect(page).toHaveURL(/\/courses\/m6$/)
  await expect(page.getByRole('heading', { name: 'Go Basics', level: 1 })).toBeVisible()
})

test('module page shows header, assignments, resources and quizzes slot', async ({ page }) => {
  await page.goto('/courses/m6')
  await expect(page.getByRole('heading', { name: 'Go Basics', level: 1 })).toBeVisible()
  await expect(page.getByText('Opened')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Assignments' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resources' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Quizzes' })).toContainText('Coming soon')
})

test('submit work with text and a file from the module page', async ({ page }) => {
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()

  const submit = page.getByRole('button', { name: 'Submit', exact: true })
  await expect(submit).toBeDisabled()

  await page.getByLabel(/Answer or link/).fill('https://github.com/me/http-server')
  await page.getByLabel(/^Files/).setInputFiles({
    name: 'report.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('pdf'),
  })
  await expect(page.getByRole('list', { name: 'Files to upload' })).toContainText('report.pdf')

  await submit.click()
  await expect(page.getByText('Your work was submitted.')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Submitted files' })).toContainText('report.pdf')
  await expect(page.getByRole('button', { name: /HTTP server/ })).toContainText('Submitted')
  await expect(page.getByRole('button', { name: 'Resubmit' })).toBeVisible()
})

test('rejects a disallowed file type', async ({ page }) => {
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()
  await page.getByLabel(/^Files/).setInputFiles({
    name: 'virus.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('x'),
  })
  await expect(page.getByRole('alert')).toContainText('only pdf, pptx, md, zip')
  await expect(page.getByRole('button', { name: 'Submit', exact: true })).toBeDisabled()
})

test('no horizontal overflow with an assignment expanded', async ({ page }) => {
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('unknown module shows not-found with a way back', async ({ page }) => {
  await page.goto('/courses/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Module not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to my courses' }).click()
  await expect(page).toHaveURL(/\/courses$/)
})

test('visual snapshot helper: module page renders in dark theme', async ({ page }) => {
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('heading', { name: 'Go Basics', level: 1 })).toBeVisible()
})
