import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { toggleTheme } from './support/theme'

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

async function signIn(page: Page, button: string) {
  await page.goto('/login')
  await page.getByRole('group', { name: 'Demo accounts' }).getByRole('button', { name: button, exact: true }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^Welcome, / })).toBeVisible()
}

async function navLinks(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  const links = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')
  await expect(links.first()).toBeVisible()
  return (await links.allTextContents()).map((t) => t.trim())
}

const cases: { button: string; nav: string[]; team: boolean; authoring: boolean }[] = [
  { button: 'Mentor & lecturer', nav: ['Dashboard', 'Course content', 'Calendar', 'My team', 'Grading', 'Office tour'], team: true, authoring: true },
  { button: 'Mentor', nav: ['Dashboard', 'Calendar', 'My team', 'Grading', 'Office tour'], team: true, authoring: false },
  { button: 'Lecturer', nav: ['Dashboard', 'Course content', 'Calendar', 'Office tour'], team: false, authoring: true },
]

for (const c of cases) {
  test(`${c.button}: one dashboard with the parts of their roles`, async ({ page, isMobile }) => {
    await signIn(page, c.button)
    const actions = page.getByRole('navigation', { name: 'Quick actions' })
    await expect(actions.getByRole('link', { name: 'New task' })).toHaveCount(c.authoring ? 1 : 0)
    await expect(actions.getByRole('link', { name: 'Set 1:1 times' })).toHaveCount(c.team ? 1 : 0)
    await expect(page.getByRole('heading', { name: /^My team · / })).toHaveCount(c.team ? 1 : 0)
    await expect(page.getByRole('heading', { name: 'Needs attention' })).toHaveCount(c.authoring ? 1 : 0)
    expect(await navLinks(page, isMobile)).toEqual(c.nav)
  })
}

test('a 1:1 the student books shows up on the mentor team page', async ({ page }) => {
  await signIn(page, 'Student')
  await page.goto('/calendar')
  await page.locator('.cell', { hasText: 'free 1:1' }).first().click()
  const dialog = page.getByRole('region', { name: 'Day details' })
  await dialog.getByRole('button', { name: /^Book / }).first().click()
  await expect(dialog.locator('.slots__item.is-mine')).toHaveCount(1)

  // same browser storage = same mock backend
  await page.evaluate(() => localStorage.removeItem('auth_user'))
  await signIn(page, 'Mentor & lecturer')
  await page.goto('/team')
  await expect(page.getByRole('list', { name: 'Booked 1:1s' })).toContainText('Sam Student')
  const sam = page.getByRole('list', { name: 'Students' }).getByRole('listitem').filter({ hasText: 'Sam Student' })
  await expect(sam).toContainText('Next 1:1:')
})

test('the mentor team page fits the screen in light and dark', async ({ page }) => {
  await signIn(page, 'Mentor')
  await page.goto('/team')
  await expect(page.getByRole('heading', { name: 'Team 4' })).toBeVisible()
  expect(await overflow(page)).toBe(false)
  await toggleTheme(page)
  expect(await overflow(page)).toBe(false)
})
