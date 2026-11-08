import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }))
  })
})

const pdf = (name: string) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from('pdf') })

test('a student hands in several versions with several files; every version stays visible', async ({ page }) => {
  await page.goto('/courses/m6')
  await page.getByRole('button', { name: /HTTP server/ }).click()

  await page.getByLabel(/Answer or link/).fill('first try')
  await page.getByLabel(/^Files/).setInputFiles([pdf('a.pdf'), pdf('b.pdf')])
  await expect(page.getByRole('list', { name: 'Files to upload' }).getByRole('listitem')).toHaveCount(2)
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByText('Your work was submitted.')).toBeVisible()

  // version 2: a.pdf and b.pdf are carried over, one more file is added
  await expect(page.getByRole('list', { name: 'Kept from the current version' })).toContainText('b.pdf')
  await page.getByLabel(/Answer or link/).fill('second try')
  await page.getByLabel(/^Files/).setInputFiles(pdf('c.pdf'))
  await page.getByRole('button', { name: 'Hand in new version' }).click()
  await expect(page.getByText('version 2', { exact: true })).toBeVisible()
  const current = page.getByRole('list', { name: 'Submitted files' })
  for (const f of ['a.pdf', 'b.pdf', 'c.pdf']) await expect(current).toContainText(f)

  // a reload keeps both versions
  await page.reload()
  await page.getByRole('button', { name: /HTTP server/ }).click()
  await page.getByText('Earlier versions (1)').click()
  const earlier = page.getByRole('list', { name: 'Earlier versions' })
  await expect(earlier).toContainText('Version 1')
  await expect(earlier).toContainText('first try')
  await expect(earlier).not.toContainText('c.pdf')
})

test('after the deadline the task is closed', async ({ page }) => {
  await page.goto('/courses/m4')
  await page.getByRole('button', { name: /Migrate a module/ }).click()
  await expect(page.getByText(/has passed\. Nothing was handed in\./)).toBeVisible()
  await expect(page.getByLabel('Answer or link')).toHaveCount(0)
})
