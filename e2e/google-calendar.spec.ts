import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** These run on the offline mock: the "Google" connection is kept in the browser, so every state can be shown. */
const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['mentor', 'lecturer'] }
const ADMIN = { id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }
const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }

async function signInAs(page: Page, user: object) {
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('a lecturer connects Google from Settings and sees the account', async ({ page }) => {
  await signInAs(page, LECTURER)
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByText('Not connected')).toBeVisible()
  await page.getByRole('button', { name: 'Connect Google Calendar' }).click()
  await expect(page.getByText('rashad@gmail.com')).toBeVisible()
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
  // the connection is remembered
  await page.reload()
  await expect(page.getByText('rashad@gmail.com')).toBeVisible()
  // and can be taken away again: the server forgets it
  await page.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Yes, disconnect' }).click()
  await expect(page.getByText('Not connected')).toBeVisible()
  await page.reload()
  await expect(page.getByText('Not connected')).toBeVisible()
})

test('Google’s way back to /settings shows the answer once and tidies the address', async ({ page }) => {
  await signInAs(page, LECTURER)
  await page.addInitScript(() => localStorage.setItem('google_mock', JSON.stringify({ connection: 'connected', account: { email: 'rashad@gmail.com', name: 'Rashad' } })))
  await page.goto('/settings?google=connected')
  await expect(page.getByText('Google Calendar is connected.')).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
})

test('a ticked event is put on Google and marked; an unticked one is not', async ({ page }) => {
  await signInAs(page, LECTURER)
  await page.addInitScript(() => localStorage.setItem('google_mock', JSON.stringify({ connection: 'connected', account: { email: 'rashad@gmail.com', name: 'Rashad' } })))
  await page.goto('/calendar')
  await page.locator('.cell.is-today + .cell').click()
  const dialog = page.getByRole('region', { name: 'Day details' })

  async function add(title: string, tick: boolean) {
    await dialog.getByRole('button', { name: 'Add a lecture or event' }).click()
    const form = dialog.getByRole('form', { name: 'New event' })
    await form.getByLabel('Title').fill(title)
    const box = form.getByRole('checkbox', { name: 'Also add to my Google Calendar' })
    await expect(box).toBeEnabled()
    if (tick) await box.check()
    await form.getByRole('button', { name: 'Add event' }).click()
  }

  await add('On google', true)
  await expect(dialog.getByText('Event added. Students can see it now. It is on your Google Calendar too.')).toBeVisible()
  await add('Only here', false)
  await expect(dialog.getByText('Event added. Students can see it now.', { exact: true })).toBeVisible()

  const cards = dialog.getByRole('list', { name: 'Events' }).getByRole('listitem')
  await expect(cards.filter({ hasText: 'On google' }).getByText('On Google Calendar')).toBeVisible()
  await expect(cards.filter({ hasText: 'Only here' }).getByText('On Google Calendar')).toHaveCount(0)

  // an existing event cannot be sent to Google later: no tick when editing one that is not there
  await cards.filter({ hasText: 'Only here' }).getByRole('button', { name: /^Edit/ }).click()
  await expect(dialog.getByRole('checkbox', { name: 'Also add to my Google Calendar' })).toHaveCount(0)
})

test('with no Google connection the tick is off and Settings is one click away', async ({ page }) => {
  await signInAs(page, LECTURER)
  await page.goto('/calendar')
  await page.locator('.cell.is-today + .cell').click()
  const dialog = page.getByRole('region', { name: 'Day details' })
  await dialog.getByRole('button', { name: 'Add a lecture or event' }).click()
  const form = dialog.getByRole('form', { name: 'New event' })
  await expect(form.getByRole('checkbox', { name: 'Also add to my Google Calendar' })).toBeDisabled()
  await form.getByRole('link', { name: 'Open Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByRole('button', { name: 'Connect Google Calendar' })).toBeVisible()
})

test('a revoked connection says Reconnect', async ({ page }) => {
  await signInAs(page, LECTURER)
  await page.addInitScript(() => localStorage.setItem('google_mock', JSON.stringify({ connection: 'reconnect', account: { email: 'rashad@gmail.com', name: 'Rashad' } })))
  await page.goto('/settings')
  await expect(page.getByText('Reconnect needed')).toBeVisible()
  await page.getByRole('button', { name: 'Reconnect Google Calendar' }).click()
  await expect(page.getByText('Connected', { exact: true })).toBeVisible()
})

test('the admin has Settings in the sidebar, and sees which events are on Google', async ({ page }) => {
  await signInAs(page, ADMIN)
  await page.addInitScript(() => localStorage.setItem('google_mock', JSON.stringify({ connection: 'connected', account: { email: 'boss@gmail.com', name: 'Boss' } })))
  await page.goto('/admin/settings')
  await expect(page.getByText('boss@gmail.com')).toBeVisible()

  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: /^Add an event/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Title').fill('Board meeting')
  await dialog.getByRole('checkbox', { name: 'Also add to my Google Calendar' }).check()
  await dialog.getByRole('button', { name: 'Add event' }).click()
  await expect(page.getByText('Event added. It is on your Google Calendar too.')).toBeVisible()

  const chip = page.getByRole('button', { name: /^On Google Calendar/ })
  await expect(chip).toContainText('1')
  await chip.click()
  const list = page.getByRole('list', { name: 'Events' })
  await expect(list.locator('.admin-cal__event')).toHaveCount(1)
  await expect(list).toContainText('Board meeting')
})

test('students have Settings, with Google in their own words and a password form', async ({ page }) => {
  await signInAs(page, STUDENT)
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByText('Connect your Google account to see your own Google Calendar on the school calendar.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible()
})

for (const width of [320, 390]) {
  test(`the Settings page fits a ${width}px phone`, async ({ page }) => {
    await signInAs(page, LECTURER)
    await page.addInitScript(() =>
      localStorage.setItem('google_mock', JSON.stringify({ connection: 'connected', account: { email: 'a.very.long.address.for.a.teacher@gmail.com', name: 'Rashad Aliyev With A Long Name' } })),
    )
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/settings')
    await expect(page.getByText('a.very.long.address.for.a.teacher@gmail.com')).toBeVisible()
    expect(await overflow(page)).toBeLessThanOrEqual(0)
  })
}
