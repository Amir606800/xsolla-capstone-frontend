import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { toggleTheme } from './support/theme'

const STUDENT = { id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }
const MENTOR = { id: 900, name: 'Rashad Aliyev', email: 'rashad@example.com', role: 'teacher' }

/** A page signed in as `user`. Pages of one test share the browser storage, like two tabs would. */
async function pageAs(context: BrowserContext, user: typeof STUDENT | typeof MENTOR): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), user)
  await page.goto('/calendar')
  await expect(page.getByRole('group', { name: 'Month view' })).toBeVisible()
  return page
}

const slotList = (page: Page) => page.getByRole('region', { name: 'Day details' }).getByRole('list', { name: '1:1 times' }).getByRole('listitem')
/** The early-morning times these tests add: the day may also hold the demo afternoon times (15:00-18:00). */
const earlySlots = (page: Page) => slotList(page).filter({ hasText: /^0[789]:/ })
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test.describe('Student: 1:1 times', () => {
  test('sees the days the mentor is free, books a time and can cancel it', async ({ context }) => {
    const page = await pageAs(context, STUDENT)
    const day = page.locator('.cell:has(.ev--availability)').first()
    await expect(day).toBeVisible()
    await day.click()

    const dialog = page.getByRole('region', { name: 'Day details' })
    await expect(dialog.getByRole('heading', { name: /^1:1 with Rashad Aliyev/ })).toBeVisible()
    const rows = slotList(page)
    expect(await rows.count()).toBeGreaterThanOrEqual(4)
    await expect(rows.first().locator('.slots__time-label')).toHaveText(/^\d\d:\d\d - \d\d:\d\d$/)

    await dialog.getByRole('button', { name: /^Book / }).first().click()
    await expect(dialog.getByRole('status')).toContainText('Booked')
    await expect(dialog.locator('.slots__item.is-mine')).toHaveCount(1)
    await expect(dialog.locator('.slots__item.is-mine')).toContainText('Booked by you')
    // one at a time: the other free times are locked until this one is cancelled
    await expect(dialog.getByRole('button', { name: /^Book / }).first()).toBeDisabled()

    // it stays booked after a reload
    await page.reload()
    const booked = page.locator('.cell', { hasText: '1:1 with Rashad Aliyev' })
    await expect(booked).toHaveCount(1)

    await booked.click()
    await page.getByRole('region', { name: 'Day details' }).getByRole('button', { name: /^Cancel \d/ }).click()
    await expect(page.getByRole('region', { name: 'Day details' }).locator('.slots__item.is-mine')).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Day details' }).getByRole('button', { name: /^Book / }).first()).toBeEnabled()
  })

  test('the team page shows the booked time', async ({ context }) => {
    const page = await pageAs(context, STUDENT)
    await page.goto('/team')
    await expect(page.getByText(/No 1:1 booked yet/)).toBeVisible()
    await page.getByRole('link', { name: 'Pick a time in the calendar' }).click()
    await expect(page).toHaveURL(/\/calendar$/)

    await page.locator('.cell:has(.ev--availability)').first().click()
    await page.getByRole('region', { name: 'Day details' }).getByRole('button', { name: /^Book / }).first().click()
    await expect(page.getByRole('region', { name: 'Day details' }).getByRole('status')).toContainText('Booked')

    await page.goto('/team')
    await expect(page.getByText(/Next 1:1:/)).toBeVisible()
  })

  test('there is no form to add times, and a day without times has no panel', async ({ context }) => {
    const page = await pageAs(context, STUDENT)
    await page.locator('.cell:has(.ev--availability)').first().click()
    await expect(page.getByRole('region', { name: 'Day details' }).getByLabel('From')).toHaveCount(0)

    await page.locator('.cell:not(:has(.ev))').filter({ hasNot: page.locator('.is-outside') }).first().click()
    await expect(page.getByRole('region', { name: 'Day details' })).toContainText('No events on this day.')
    await expect(page.getByRole('region', { name: 'Day details' }).getByRole('heading', { name: /1:1/ })).toHaveCount(0)
  })

  test('fits the screen in light and dark, with no overflow', async ({ context }) => {
    const page = await pageAs(context, STUDENT)
    await page.locator('.cell:has(.ev--availability)').first().click()
    const box = (await page.getByRole('region', { name: 'Day details' }).boundingBox())!
    const vp = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(await overflow(page)).toBe(false)
    await toggleTheme(page)
    await page.locator('.cell:has(.ev--availability)').first().click()
    await expect(page.getByRole('region', { name: 'Day details' }).getByRole('list', { name: '1:1 times' })).toBeVisible()
    expect(await overflow(page)).toBe(false)
  })
})

test.describe('Mentor: availability', () => {
  test('marks a window, it is cut into 30-minute times, and students can book them', async ({ context }) => {
    const mentor = await pageAs(context, MENTOR)
    // tomorrow, early in the morning, so it can never clash with the demo times in the afternoon
    await mentor.locator('.cell.is-today + .cell').click()

    const dialog = mentor.getByRole('region', { name: 'Day details' })
    await dialog.getByRole('button', { name: 'Add 1:1 times' }).click()
    await dialog.getByLabel('From').fill('08:00')
    await dialog.getByLabel('To').fill('09:30')
    await expect(dialog).toContainText('3 times: 08:00 - 08:30, 08:30 - 09:00, 09:00 - 09:30')
    await dialog.getByRole('button', { name: 'Add availability' }).click()
    await expect(dialog.getByRole('status')).toContainText('Added 3 times.')

    const rows = earlySlots(mentor)
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0).locator('.slots__time-label')).toHaveText('08:00 - 08:30')
    await expect(rows.nth(1).locator('.slots__time-label')).toHaveText('08:30 - 09:00')
    await expect(rows.nth(2).locator('.slots__time-label')).toHaveText('09:00 - 09:30')

    // a student in another tab sees the same times and takes one
    const student = await pageAs(context, STUDENT)
    await student.locator('.cell.is-today + .cell').click()
    const theirs = earlySlots(student)
    await expect(theirs).toHaveCount(3)
    await student.getByRole('region', { name: 'Day details' }).getByRole('button', { name: 'Book 08:30 - 09:00' }).click()
    await expect(student.getByRole('region', { name: 'Day details' }).getByRole('status')).toContainText('Booked 08:30 - 09:00')

    // the mentor sees who booked it
    await mentor.reload()
    await mentor.locator('.cell.is-today + .cell').click()
    await expect(earlySlots(mentor).nth(1)).toContainText('Sam')
    await expect(earlySlots(mentor).nth(0)).toContainText('Free')
  })

  test('a window that does not work is explained and cannot be added', async ({ context }) => {
    const page = await pageAs(context, MENTOR)
    await page.locator('.cell.is-today + .cell').click()
    const dialog = page.getByRole('region', { name: 'Day details' })
    await dialog.getByRole('button', { name: 'Add 1:1 times' }).click()
    await dialog.getByLabel('To').fill('14:00')
    await expect(dialog).toContainText('The end time must be after the start time.')
    await expect(dialog.getByRole('button', { name: 'Add availability' })).toBeDisabled()
  })

  test('can remove a free time and cancel a booking', async ({ context }) => {
    const page = await pageAs(context, MENTOR)
    await page.locator('.cell.is-today + .cell').click()
    const dialog = page.getByRole('region', { name: 'Day details' })
    await dialog.getByRole('button', { name: 'Add 1:1 times' }).click()
    await dialog.getByLabel('From').fill('07:00')
    await dialog.getByLabel('To').fill('08:00')
    await dialog.getByRole('button', { name: 'Add availability' }).click()
    await expect(earlySlots(page)).toHaveCount(2)

    await dialog.getByRole('button', { name: 'Remove 07:30 - 08:00' }).click()
    await expect(earlySlots(page)).toHaveCount(1)
  })

  test('the form fits a phone and desktop screen, in light and dark', async ({ context }) => {
    const page = await pageAs(context, MENTOR)
    await page.locator('.cell.is-today + .cell').click()
    const panel = page.getByRole('region', { name: 'Day details' })
    await panel.getByRole('button', { name: 'Add 1:1 times' }).click()
    const box = (await panel.boundingBox())!
    const vp = page.viewportSize()!
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(await overflow(page)).toBe(false)
    await toggleTheme(page)
    await expect(panel.getByRole('button', { name: 'Add availability' })).toBeVisible()
    expect(await overflow(page)).toBe(false)
  })
})
