import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signInAsAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible()
}

test('the admin opens a module, reads a quiz with its answers, and deletes a task', async ({ page }) => {
  await signInAsAdmin(page)
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Modules' }).click()
  const modules = page.getByRole('table', { name: 'Modules' })
  await expect(modules.getByRole('row')).toHaveCount(13)

  await modules.getByRole('link', { name: 'React', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/modules\/m5$/)
  await page.getByRole('button', { name: 'View Hooks basics' }).click()
  const details = page.getByRole('dialog')
  await expect(details.getByText('(correct answer)')).toHaveCount(5)
  await details.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: 'Delete Components' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete task' }).click()
  await expect(page.getByText('“Components” deleted.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Components' })).toHaveCount(0)

  // the change stays after a reload (the offline demo keeps it in this browser)
  await page.reload()
  await expect(page.getByRole('button', { name: 'View State management', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View Components' })).toHaveCount(0)
})

test('the admin creates a module with a task, and a student sees it', async ({ page }) => {
  await signInAsAdmin(page)
  await page.goto('/admin/modules')
  await page.getByRole('button', { name: 'New module' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Title').fill('Kubernetes')
  await form.getByLabel('Opens on').fill('2026-01-05')
  await form.getByLabel('Closes on').fill('2026-01-11')
  await form.getByRole('button', { name: 'Create module' }).click()
  await expect(page.getByRole('heading', { name: 'Kubernetes', level: 1 })).toBeVisible()

  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill('Deploy an app')
  await page.getByRole('dialog').getByRole('button', { name: 'Add task' }).click()
  await expect(page.getByText('Task added.')).toBeVisible()

  // the student side of the same browser (offline demo) has the new module
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.goto('/login')
  await page.getByLabel('Email').fill('student@xsolla.school')
  await page.getByLabel('Password', { exact: true }).fill('secret')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/courses')
  await expect(page.getByText('Kubernetes').first()).toBeVisible()
})

test('the modules pages and the details pop-up fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 })
  await signInAsAdmin(page)
  for (const path of ['/admin/modules', '/admin/modules/m5']) {
    await page.goto(path)
    await expect(page.getByRole('table')).toBeVisible()
    // wide tables scroll inside their box; the page itself never scrolls sideways
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  }
  await page.getByRole('button', { name: 'View Hooks basics' }).click()
  // the details keep a gap from the pop-up's edges
  const gap = await page.locator('.admin-dialog').evaluate((el) => {
    const box = el.getBoundingClientRect()
    const first = el.querySelector('dt')!.getBoundingClientRect()
    return first.left - box.left
  })
  expect(gap).toBeGreaterThanOrEqual(16)
})
