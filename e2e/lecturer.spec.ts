import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { toggleTheme } from './support/theme'

const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', role: 'teacher' }
const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', role: 'student' }

/** A tab signed in as `user`. Tabs of one test share the browser storage, so they see each other's changes. */
async function tabAs(context: BrowserContext, user: typeof LECTURER | typeof STUDENT, path: string): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
  // a lecturer changes only the modules assigned to them: week 6 (Elvin's in the demo) is given to Rashad too
  await page.addInitScript(() => {
    const edits = JSON.parse(localStorage.getItem('course_edits') ?? '{"modules":{},"items":{}}')
    edits.modules = { ...edits.modules, m6: { ...edits.modules?.m6, lecturerIds: [900, 902] } }
    localStorage.setItem('course_edits', JSON.stringify(edits))
  })
  await page.goto(path)
  return page
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test('signs in with the lecturer demo account and gets the lecturer navigation', async ({ page, isMobile }) => {
  await page.goto('/login')
  await page.getByRole('group', { name: 'Demo accounts' }).getByRole('button', { name: 'Mentor & lecturer' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome, Rashad Aliyev', level: 1 })).toBeVisible()

  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(nav.getByRole('link', { name: 'Course content' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Tasks', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'My grades' })).toHaveCount(0)

  // student pages are not for lecturers
  await page.goto('/grades')
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('a task added from the dashboard shortcut shows up for the student', async ({ context }) => {
  const lecturer = await tabAs(context, LECTURER, '/dashboard')
  await lecturer.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'New task' }).click()
  const dialog = lecturer.getByRole('dialog', { name: 'New task' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Title').fill('Goroutines kata')
  await dialog.getByLabel(/What to hand in/).fill('Push to the repo\nShort README')
  await dialog.getByRole('button', { name: 'Add task' }).click()
  await expect(lecturer.getByRole('status')).toHaveText('Task added.')
  await expect(lecturer.getByRole('region', { name: 'Tasks' })).toContainText('Goroutines kata')

  const student = await tabAs(context, STUDENT, '/tasks')
  await expect(student.getByRole('region', { name: 'Tasks' })).toContainText('Goroutines kata')
  await student.goto('/calendar')
  await expect(student.locator('.cell', { hasText: 'Due: Goroutines kata' })).toHaveCount(1)
})

test('a link material and a quiz show up in the module for the student, without the answers', async ({ context }) => {
  const lecturer = await tabAs(context, LECTURER, '/courses')
  // the list starts on the modules assigned to this lecturer (the odd weeks); week 6 is another lecturer's
  await lecturer.getByRole('button', { name: /^All modules/ }).click()
  await lecturer.getByRole('link', { name: /Module 6/ }).click()

  await lecturer.getByRole('button', { name: 'Add', exact: true }).click()
  let dialog = lecturer.getByRole('dialog')
  await dialog.getByLabel('Title').fill('Tour of Go')
  await dialog.getByLabel('Type').selectOption('link')
  await dialog.getByLabel('Link').fill('https://go.dev/tour')
  await dialog.getByRole('button', { name: 'Add material' }).click()
  await expect(lecturer.getByRole('status')).toHaveText('Material added.')

  await lecturer.getByRole('button', { name: 'New quiz' }).click()
  dialog = lecturer.getByRole('dialog')
  await dialog.getByLabel('Title').fill('Week 6 check')
  await dialog.getByLabel('Question 1 text').fill('Which keyword starts a goroutine?')
  await dialog.getByLabel('Question 1: answer 1', { exact: true }).fill('go')
  await dialog.getByLabel('Question 1: answer 2', { exact: true }).fill('async')
  await dialog.getByLabel('Question 1: answer 1 is right').check()
  await dialog.getByRole('button', { name: 'Add quiz' }).click()
  await expect(lecturer.getByRole('status')).toHaveText('Quiz added.')

  const student = await tabAs(context, STUDENT, '/courses/m6')
  await expect(student.getByRole('link', { name: 'Open Tour of Go' })).toHaveAttribute('href', 'https://go.dev/tour')
  const quizzes = student.getByRole('region', { name: 'Quizzes' })
  await expect(quizzes).toContainText('Week 6 check')
  await expect(quizzes).toContainText('1 question')
  await expect(quizzes).not.toContainText('async')
})

test('a lecture scheduled on the calendar shows up for the student', async ({ context }) => {
  const lecturer = await tabAs(context, LECTURER, '/calendar')
  await lecturer.locator('.cell.is-today + .cell').click()
  const dialog = lecturer.getByRole('region', { name: 'Day details' })
  await dialog.getByRole('button', { name: 'Add a lecture' }).click()
  const form = dialog.getByRole('form', { name: 'New lecture' })
  await form.getByLabel('Title').fill('Guest talk: Go at scale')
  await form.getByLabel('Starts').fill('07:00')
  await form.getByLabel('Ends').fill('08:00')
  await form.getByLabel(/Module/).selectOption('m6')
  await form.getByRole('button', { name: 'Add lecture' }).click()
  await expect(dialog.getByText('Event added. Students can see it now.')).toBeVisible()

  const student = await tabAs(context, STUDENT, '/calendar')
  await student.locator('.cell.is-today + .cell').click()
  const card = student.getByRole('region', { name: 'Day details' }).getByRole('list', { name: 'Events' }).getByRole('listitem').filter({ hasText: 'Guest talk' })
  await expect(card).toContainText('07:00 - 08:00')
  await expect(card.getByRole('link', { name: 'Open module' })).toHaveAttribute('href', '/courses/m6')
  await expect(card.getByRole('button', { name: /Edit|Delete/ })).toHaveCount(0)
})

test('editing and deleting ask before removing anything', async ({ context }) => {
  const lecturer = await tabAs(context, LECTURER, '/courses/m6')
  await lecturer.getByRole('button', { name: 'Delete HTTP server' }).click()
  await lecturer.getByRole('button', { name: 'Keep' }).click()
  await expect(lecturer.getByRole('region', { name: 'Tasks' })).toContainText('HTTP server')
  await lecturer.getByRole('button', { name: 'Delete HTTP server' }).click()
  await lecturer.getByRole('button', { name: 'Yes, delete' }).click()
  await expect(lecturer.getByRole('status')).toHaveText('Task deleted.')
  await expect(lecturer.getByRole('region', { name: 'Tasks' })).not.toContainText('HTTP server')
})

for (const path of ['/dashboard', '/courses', '/courses/m6']) {
  test(`${path} fits the screen in light and dark`, async ({ context }) => {
    const page = await tabAs(context, LECTURER, path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await overflow(page)).toBe(false)
    await toggleTheme(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await overflow(page)).toBe(false)
  })
}

test('the quiz form fits inside the pop-up on every screen', async ({ context }) => {
  const page = await tabAs(context, LECTURER, '/courses/m6?add=quiz')
  const modal = page.locator('.modal')
  await expect(modal).toBeVisible()
  const box = (await modal.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  // long forms scroll inside the pop-up, so the save button is always reachable
  await page.getByRole('dialog').getByRole('button', { name: 'Add quiz' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Add quiz' })).toBeInViewport()
})

test('the lecturer can download a material from the module editor', async ({ context }) => {
  const page = await tabAs(context, LECTURER, '/courses/m6')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Go Basics - lecture slides' }).click()
  expect((await download).suggestedFilename()).toMatch(/-demo\.txt$/)
})

test('the calendar day panel: events in one part, what the role can add in another, beside the month on a wide screen', async ({ context, isMobile }) => {
  const page = await tabAs(context, LECTURER, '/calendar')
  const panel = page.getByRole('region', { name: 'Day details' })
  await expect(panel.getByRole('heading', { name: 'On this day' })).toBeVisible()
  await expect(panel.getByRole('group', { name: 'Add to this day' })).toBeVisible()
  await panel.getByRole('button', { name: 'Add a lecture' }).click()
  await expect(panel.getByRole('form', { name: 'New lecture' })).toBeVisible()
  expect(await overflow(page)).toBe(false)

  if (!isMobile) {
    await page.setViewportSize({ width: 1600, height: 900 })
    const month = (await page.locator('.month').boundingBox())!
    const side = (await panel.boundingBox())!
    expect(side.x).toBeGreaterThanOrEqual(month.x + month.width) // beside it, not under it
    await page.setViewportSize({ width: 1100, height: 900 })
    const under = (await panel.boundingBox())!
    const grid = (await page.locator('.month').boundingBox())!
    expect(under.y).toBeGreaterThanOrEqual(grid.y + grid.height - 1)
    expect(await overflow(page)).toBe(false)
  }
})
