import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', roles: ['mentor', 'lecturer'] }
const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const MEET = 'https://meet.google.com/abc-defg-hij'

/** Tomorrow at hh:mm, local: the lecture is made for "the day after today's cell" by the lecturer's tab. */
const tomorrowAt = (h: number, m = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(h, m, 0, 0)
  return d
}

/** A tab signed in as `user`, with the browser's clock stopped at `at` (the tabs share one storage). */
async function tabAs(context: BrowserContext, user: object, path: string, at?: Date): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
  if (at) await page.clock.setFixedTime(at)
  await page.goto(path)
  return page
}

async function addLecture(context: BrowserContext, link: string) {
  const lecturer = await tabAs(context, LECTURER, '/calendar')
  await lecturer.locator('.cell.is-today + .cell').click()
  const dialog = lecturer.getByRole('region', { name: 'Day details' })
  await dialog.getByRole('button', { name: 'Add a lecture' }).click()
  const form = dialog.getByRole('form', { name: 'New lecture' })
  await form.getByLabel('Title').fill('Guest talk')
  await form.getByLabel('Starts').fill('07:00')
  await form.getByLabel('Ends').fill('08:00')
  if (link) await form.getByLabel(/^Meeting link/).fill(link)
  await form.getByRole('button', { name: 'Add lecture' }).click()
  await expect(dialog.getByText('Event added. Students can see it now.')).toBeVisible()
  return lecturer
}

test('the lecturer sees the link at once; a link that is not https is refused', async ({ context }) => {
  const lecturer = await tabAs(context, LECTURER, '/calendar')
  await lecturer.locator('.cell.is-today + .cell').click()
  const dialog = lecturer.getByRole('region', { name: 'Day details' })
  await dialog.getByRole('button', { name: 'Add a lecture' }).click()
  const form = dialog.getByRole('form', { name: 'New lecture' })
  await form.getByLabel('Title').fill('Guest talk')
  await form.getByLabel(/^Meeting link/).fill('http://meet.google.com/abc')
  await form.getByRole('button', { name: 'Add lecture' }).click()
  await expect(form.getByText('The link must start with https://.')).toBeVisible()
  await form.getByLabel(/^Meeting link/).fill(MEET)
  await form.getByRole('button', { name: 'Add lecture' }).click()
  const card = dialog.getByRole('list', { name: 'Events' }).getByRole('listitem').filter({ hasText: 'Guest talk' })
  await expect(card.getByRole('link', { name: /Open Google Meet link/ })).toHaveAttribute('href', MEET)
})

test('students are told when the link is added', async ({ context }) => {
  await addLecture(context, MEET)
  const student = await tabAs(context, STUDENT, '/dashboard')
  await student.getByRole('button', { name: /^Notifications/ }).click()
  const dialog = student.getByRole('dialog')
  await expect(dialog).toContainText('Guest talk')
  await expect(dialog).toContainText('the meeting link is ready.')
})

test('a lecture without a link tells nobody', async ({ context }) => {
  await addLecture(context, '')
  const student = await tabAs(context, STUDENT, '/dashboard')
  await student.getByRole('button', { name: /^Notifications/ }).click()
  await expect(student.getByRole('dialog')).not.toContainText('the meeting link')
})

test('a student sees the Join button only from 30 minutes before the start until the end', async ({ context }) => {
  await addLecture(context, MEET)
  const card = (page: Page) => page.getByRole('region', { name: 'Day details' }).getByRole('list', { name: 'Events' }).getByRole('listitem').filter({ hasText: 'Guest talk' })
  const look = async (at: Date) => {
    const page = await tabAs(context, STUDENT, '/calendar', at)
    await page.locator('.cell.is-today').click()
    return page
  }

  // 05:00: too early. The address is not even in the page.
  let page = await look(tomorrowAt(5))
  await expect(card(page)).toContainText('The link to join appears 30 minutes before the start, at 06:30.')
  await expect(card(page).getByRole('link', { name: /Google Meet/ })).toHaveCount(0)
  expect(await page.content()).not.toContain('meet.google.com')

  // 06:45: inside the window
  page = await look(tomorrowAt(6, 45))
  await expect(card(page).getByRole('link', { name: /Join Google Meet/ })).toHaveAttribute('href', MEET)
  await expect(card(page).getByRole('link', { name: /Join Google Meet/ })).toHaveAttribute('target', '_blank')

  // 07:30: during the lecture
  page = await look(tomorrowAt(7, 30))
  await expect(card(page).getByRole('link', { name: /Join Google Meet/ })).toBeVisible()

  // 08:30: over
  page = await look(tomorrowAt(8, 30))
  await expect(card(page)).toBeVisible()
  await expect(card(page).getByRole('link', { name: /Google Meet/ })).toHaveCount(0)
})

test('the admin is warned about a lecture that starts soon and has no link', async ({ context }) => {
  // a lecture with no link tomorrow at 07:00; the admin looks the evening before
  await addLecture(context, '')
  const admin = await context.newPage()
  await admin.addInitScript(() => localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] })))
  await admin.clock.setFixedTime(tomorrowAt(0, 1))
  await admin.goto('/admin/notifications')
  await expect(admin.getByRole('list', { name: 'Needs attention' })).toContainText('has no meeting link')
  await expect(admin.getByRole('link', { name: 'Add the link' })).toHaveAttribute('href', '/admin/calendar')
})
