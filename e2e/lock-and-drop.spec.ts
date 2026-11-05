import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signInAs(page: Page, role: 'student' | 'teacher') {
  await page.addInitScript((r) => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: r }))
  }, role)
}

test.describe('future modules are locked for students', () => {
  test('the dashboard path shows them locked and not clickable', async ({ page }) => {
    await signInAs(page, 'student')
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible()

    const locked = page.getByRole('group', { name: /^Module 7: .*locked, opens/ })
    await expect(locked).toBeVisible()
    await expect(locked).toContainText(/Opens/)
    await expect(page.getByRole('link', { name: /^Module 7:/ })).toHaveCount(0)

    await locked.click({ force: true })
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('My courses shows locked cards that cannot be opened', async ({ page }) => {
    await signInAs(page, 'student')
    await page.goto('/courses')
    const card = page.getByLabel('Module 8: REST APIs, locked')
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Opens/)
    await card.click()
    await expect(page).toHaveURL(/\/courses$/)
  })

  test('typing the URL of a future module only shows that it is locked', async ({ page }) => {
    await signInAs(page, 'student')
    await page.goto('/courses/m9')
    await expect(page.getByRole('heading', { name: 'Docker', level: 1 })).toBeVisible()
    await expect(page.getByText(/This module opens on/)).toBeVisible()
    await expect(page.getByRole('region', { name: 'Assignments' })).toHaveCount(0)
    await expect(page.getByText('Dockerise an app')).toHaveCount(0)

    await page.getByRole('link', { name: 'Back to my courses' }).click()
    await expect(page).toHaveURL(/\/courses$/)
  })

  test('the current module is open', async ({ page }) => {
    await signInAs(page, 'student')
    await page.goto('/courses/m6')
    await expect(page.getByRole('region', { name: 'Assignments' })).toBeVisible()
  })

  test('teachers are not locked out: they edit every module, also future ones', async ({ page }) => {
    await signInAs(page, 'teacher')
    await page.goto('/courses/m9')
    await expect(page.getByRole('region', { name: 'Tasks' })).toBeVisible()
    await page.goto('/courses')
    await page.getByRole('link', { name: /Module 12 · Capstone/ }).click()
    await expect(page).toHaveURL(/\/courses\/m12$/)
  })
})

test.describe('drag & drop files', () => {
  async function drag(page: Page, selector: string, type: 'dragenter' | 'dragover' | 'drop' | 'dragleave', names: string[]) {
    const dt = await page.evaluateHandle((files) => {
      const t = new DataTransfer()
      for (const n of files) t.items.add(new File(['x'], n, { type: 'application/pdf' }))
      return t
    }, names)
    await page.dispatchEvent(selector, type, { dataTransfer: dt })
  }

  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'student')
    await page.goto('/courses/m6')
    await page.getByRole('button', { name: /HTTP server/ }).click()
  })

  test('highlights the drop area while dragging and clears it on leave', async ({ page }) => {
    const zone = page.getByRole('group', { name: 'File drop area' })
    await expect(zone).toContainText('Drag & drop files here')

    await drag(page, '.dropzone', 'dragenter', ['a.pdf'])
    await expect(zone).toHaveClass(/is-dragging/)
    await expect(zone).toContainText('Drop to add the files')

    await drag(page, '.dropzone', 'dragleave', ['a.pdf'])
    await expect(zone).not.toHaveClass(/is-dragging/)
  })

  test('dropping files adds them, then they can be submitted', async ({ page }) => {
    await drag(page, '.dropzone', 'dragenter', ['report.pdf', 'notes.md'])
    await drag(page, '.dropzone', 'drop', ['report.pdf', 'notes.md'])

    const queued = page.getByRole('list', { name: 'Files to upload' })
    await expect(queued).toContainText('report.pdf')
    await expect(queued).toContainText('notes.md')
    await expect(page.getByRole('group', { name: 'File drop area' })).not.toHaveClass(/is-dragging/)

    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await expect(page.getByText('Your work was submitted.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Submitted files' })).toContainText('report.pdf')
    await expect(page.getByRole('button', { name: /HTTP server/ })).toContainText('Submitted')
  })

  test('rejects a dropped file of the wrong type', async ({ page }) => {
    await drag(page, '.dropzone', 'drop', ['virus.exe'])
    await expect(page.getByRole('alert')).toContainText('only pdf, pptx, md, zip')
    await expect(page.getByRole('list', { name: 'Files to upload' })).toHaveCount(0)
  })

  test('clicking the drop area still opens the normal file picker', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser')
    await page.locator('.dropzone').click()
    const fc = await chooser
    expect(fc.isMultiple()).toBe(true)
    await fc.setFiles({ name: 'picked.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') })
    await expect(page.getByRole('list', { name: 'Files to upload' })).toContainText('picked.pdf')
  })
})
