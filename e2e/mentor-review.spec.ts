import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Offline demo store: the flag makes the demo student owe last week's review (locked) or this week's (reminder). */
const STUDENT = { id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }
const MENTOR = { id: 900, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['mentor', 'lecturer'] }

async function signIn(page: Page, user: object, mode?: 'locked' | 'reminder') {
  await page.addInitScript(
    ([u, m]) => {
      localStorage.setItem('auth_user', JSON.stringify(u))
      // set once: the review that is sent must survive the reloads below
      if (m && !localStorage.getItem('mentor_reviews')) localStorage.setItem('mentor_review_demo', m as string)
    },
    [user, mode] as const,
  )
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test('a student who owes last week is locked onto the form; sending it opens the LMS', async ({ page }) => {
  test.setTimeout(60_000) // five page loads and a long form
  await signIn(page, STUDENT, 'locked')
  for (const path of ['/dashboard', '/courses', '/calendar', '/team']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/mentor-review$/)
  }
  await expect(page.getByRole('alert')).toContainText('The LMS is locked until you send it')
  const form = page.getByRole('form', { name: /^Review of week/ })
  await expect(form).toContainText('Rashad Aliyev')
  expect(await overflow(page)).toBeLessThanOrEqual(0)

  await form.getByRole('button', { name: 'Send review' }).click()
  await expect(form.getByText('Some answers are missing.')).toBeVisible()

  await form.getByText('Yes', { exact: true }).click()
  await form.getByText('Homework defense and code logic').click()
  for (const statement of [/guidance was clear/, /actively engaged/, /comfortable asking/, /enough time/]) {
    await form.getByRole('group', { name: statement }).getByRole('radio', { name: /^4/ }).check({ force: true })
  }
  await form.getByRole('group', { name: /Overall, how satisfied/ }).getByRole('radio', { name: /^5/ }).check({ force: true })
  await form.getByLabel(/Any comments or suggestions/).fill('All good')
  await form.getByRole('button', { name: 'Send review' }).click()
  await expect(page.getByText('Thank you, your review is sent.')).toBeVisible()

  // open again, and it stays open after a reload
  await page.goto('/courses')
  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByRole('heading', { name: 'My courses' })).toBeVisible()
})

test('on the weekend a reminder sits on top of the page and nothing is locked', async ({ page }) => {
  await signIn(page, STUDENT, 'reminder')
  await page.goto('/dashboard')
  const reminder = page.getByRole('complementary', { name: 'Weekly mentor review' })
  await expect(reminder).toContainText('Review your week with Rashad Aliyev.')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(await overflow(page)).toBeLessThanOrEqual(0)
  await reminder.getByRole('link', { name: 'Review now' }).click()
  await expect(page.getByRole('form', { name: /^Review of week/ })).toBeVisible()
})

test('mentors are never locked', async ({ page }) => {
  await signIn(page, MENTOR, 'locked')
  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: 'Grading' })).toBeVisible()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/mentor-review')
  await expect(page).toHaveURL(/\/dashboard$/)
})
