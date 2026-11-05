import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }))
  })
})

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

async function openFromSidebar(page: Page, isMobile: boolean, link: string) {
  await page.goto('/dashboard')
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('link', { name: link, exact: true }).click()
}

test.describe('My grades', () => {
  test('opens from the sidebar', async ({ page, isMobile }) => {
    await openFromSidebar(page, isMobile, 'My grades')
    await expect(page).toHaveURL(/\/grades$/)
    await expect(page.getByRole('heading', { name: 'My grades', level: 1 })).toBeVisible()
  })

  test('shows the current standing from the mentor, with no points or percentages', async ({ page }) => {
    await page.goto('/grades')
    await expect(page.getByRole('img', { name: 'Current standing: Falling behind' })).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/\d+\s*\/\s*\d+|\d+\s*%/)
  })

  test('shows one square for each of the 12 weeks, coloured by the mentor rating', async ({ page }) => {
    await page.goto('/grades')
    const tiles = page.getByRole('list', { name: 'Weekly standing' }).getByRole('listitem')
    await expect(tiles).toHaveCount(12)
    await expect(tiles.nth(0)).toHaveClass(/week-tile--green/)
    await expect(tiles.nth(1)).toHaveClass(/week-tile--red/)
    await expect(tiles.nth(3)).toHaveClass(/week-tile--yellow/)
    await expect(tiles.nth(11)).toHaveClass(/week-tile--none/)

    const bg = (i: number) => tiles.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(new Set([await bg(0), await bg(1), await bg(3), await bg(11)]).size).toBe(4)
  })

  test('the level pills are really coloured green, yellow and red', async ({ page }) => {
    await page.goto('/grades')
    const list = page.getByRole('list', { name: 'Weekly ratings' })
    await expect(list.locator('.standing-pill').first()).toBeVisible()
    const colour = (cls: string) => list.locator(`.standing-pill--${cls}`).first().evaluate((el) => getComputedStyle(el).color)
    const [g, y, r] = [await colour('green'), await colour('yellow'), await colour('red')]
    expect(new Set([g, y, r]).size).toBe(3)
    const rgb = (c: string) => c.match(/\d+/g)!.map(Number)
    expect(rgb(g)[1]).toBeGreaterThan(rgb(g)[0]) // green channel wins
    expect(rgb(r)[0]).toBeGreaterThan(rgb(r)[2]) // red channel wins
    expect(rgb(y)[0]).toBeGreaterThan(rgb(y)[2]) // amber: red and green high, blue low
  })

  test('lists the rated weeks, newest first, with the mentor note', async ({ page }) => {
    await page.goto('/grades')
    const rows = page.getByRole('list', { name: 'Weekly ratings' }).getByRole('listitem')
    await expect(rows).toHaveCount(5)
    await expect(rows.first()).toContainText('Week 5')
    await expect(rows.last()).toContainText('Week 1')
    await expect(rows.last()).toContainText('Great start')
  })

  test('warns about the run of yellow weeks and explains the rules', async ({ page }) => {
    await page.goto('/grades')
    await expect(page.getByRole('alert')).toContainText('2 yellow weeks in a row. At 4 in a row it counts as red.')
    const rules = page.getByRole('heading', { name: 'How it works' }).locator('xpath=ancestor::section[1]')
    await expect(rules).toContainText('2 red weeks in a row mean removal from the program')
  })

  test('lists graded tasks with the lecturer feedback', async ({ page }) => {
    await page.goto('/grades')
    const list = page.getByRole('list', { name: 'Graded tasks' })
    await expect(list.getByRole('listitem').first()).toContainText('Graded')
    await expect(list).toContainText('“')
  })

  test('the dashboard shows the same standing instead of a percentage', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText('My standing')).toBeVisible()
    await expect(page.locator('.score').getByRole('img', { name: 'Current standing: Falling behind' })).toBeVisible()
    await expect(page.locator('.score')).not.toContainText('%')
  })

  test('works in dark theme with no horizontal overflow', async ({ page }) => {
    await page.goto('/grades')
    await expect(page.getByRole('list', { name: 'Weekly standing' })).toBeVisible()
    expect(await overflow(page)).toBe(false)
    await page.getByRole('button', { name: 'Toggle theme' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await overflow(page)).toBe(false)
  })
})

test.describe('A graded task is final', () => {
  test('on the module page there is nothing left to do once it is graded', async ({ page }) => {
    await page.goto('/courses/m4')
    await page.getByRole('button', { name: /Typed utils/ }).click()
    await expect(page.getByText('This task has been graded, so it can no longer be changed.')).toBeVisible()
    await expect(page.getByLabel('Answer or link')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Submit|Resubmit)$/ })).toHaveCount(0)
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
  })

  test('the same on the Tasks page, in the Graded view', async ({ page }) => {
    await page.goto('/tasks?status=graded')
    const first = page.getByRole('region', { name: 'Tasks' }).locator('li.assignment').first()
    await first.getByRole('button').first().click()
    await expect(first).toContainText('can no longer be changed')
    await expect(first.getByRole('button', { name: /^(Submit|Resubmit)$/ })).toHaveCount(0)
  })

  test('work that is only submitted, not graded, can still be replaced', async ({ page }) => {
    await page.goto('/courses/m6')
    await page.getByRole('button', { name: /CLI tool/ }).click()
    await expect(page.getByLabel('Answer or link')).toBeVisible()
    await expect(page.getByText('Resubmitting replaces your previous submission until it is graded.')).toBeVisible()
  })
})

test.describe('My team', () => {
  test('opens from the sidebar', async ({ page, isMobile }) => {
    await openFromSidebar(page, isMobile, 'My team')
    await expect(page).toHaveURL(/\/team$/)
    await expect(page.getByRole('heading', { name: 'My team', level: 1 })).toBeVisible()
  })

  test('shows one mentor and a team of 4-5 students, with the student marked', async ({ page }) => {
    await page.goto('/team')
    const members = page.getByRole('list', { name: 'Team members' }).getByRole('listitem')
    await expect(members.first()).toBeVisible()
    const n = await members.count()
    expect(n).toBeGreaterThanOrEqual(4)
    expect(n).toBeLessThanOrEqual(5)
    await expect(page.getByText('You', { exact: true })).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Your mentor' })).toBeVisible()
    await expect(page.getByText('Mentor of Team 3')).toBeVisible()
  })

  test('points to the calendar for a 1:1 and shows the cohort note', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByText(/No 1:1 booked yet/)).toBeVisible()
    await expect(page.getByText(/29 students in 6 teams of 4-5/)).toBeVisible()
  })

  test('uses the name of the signed-in student', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('list', { name: 'Team members' })).toContainText('Sam')
  })

  test('fits the screen in light and dark, with no overflow', async ({ page }) => {
    await page.goto('/team')
    await expect(page.getByRole('heading', { name: 'Your mentor' })).toBeVisible()
    expect(await overflow(page)).toBe(false)
    await page.getByRole('button', { name: 'Toggle theme' }).click()
    expect(await overflow(page)).toBe(false)
  })

  test('the two cards sit side by side on desktop and stack on a phone', async ({ page, isMobile }) => {
    await page.goto('/team')
    const a = (await page.getByRole('heading', { name: 'Team 3' }).boundingBox())!
    const b = (await page.getByRole('heading', { name: 'Your mentor' }).boundingBox())!
    if (isMobile) expect(b.y).toBeGreaterThan(a.y)
    else expect(Math.abs(a.y - b.y)).toBeLessThan(4)
  })
})
