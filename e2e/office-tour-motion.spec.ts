import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Holds the tour page back so the teleport can be watched from start to end. */
async function openTourPage(page: Page, path = '/office-tour') {
  await page.goto(path)
  const link = page.getByRole('link', { name: 'Start the 360° office tour' })
  const tourUrl = new URL((await link.getAttribute('href'))!)
  await page.route(`${tourUrl.origin}/**`, () => {}) // never answers: the page stays here
  return link
}

const asStudent = (page: Page) =>
  page.addInitScript(() =>
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] })),
  )

test('the teleport only animates transform and opacity, so it runs on the GPU', async ({ page }) => {
  await asStudent(page)
  const link = await openTourPage(page)
  await link.click()
  await expect(page.locator('.teleport.is-playing')).toBeAttached()

  const animated = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.effect instanceof KeyframeEffect && (a.effect.target as Element | null)?.closest('.teleport'))
      .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)))
      .filter((p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p)),
  )
  expect(animated.length).toBeGreaterThan(0)
  expect(new Set(animated)).toEqual(new Set(['transform', 'opacity']))
})

test('the picture grows from the frame to the whole screen', async ({ page }) => {
  await asStudent(page)
  const link = await openTourPage(page)
  await link.scrollIntoViewIfNeeded()
  const start = (await link.locator('.tour__view').boundingBox())!
  await link.click()
  await expect(page.locator('.teleport.is-playing')).toBeAttached()

  // stop the clock of every part at the same moment (before the tour opens) and measure
  const at = (ms: number) =>
    page.evaluate((t) => {
      for (const a of document.getAnimations()) {
        a.pause()
        a.currentTime = t
      }
    }, ms)
  const portal = page.locator('.teleport__portal')

  await at(0) // right where the picture was
  const first = (await portal.boundingBox())!
  expect(Math.abs(first.x - start.x)).toBeLessThan(2)
  expect(Math.abs(first.y - start.y)).toBeLessThan(2)
  expect(Math.abs(first.width - start.width)).toBeLessThan(2)

  await at(400) // on its way
  const middle = (await portal.boundingBox())!
  expect(middle.width).toBeGreaterThan(start.width)

  await at(800) // the whole screen
  const viewport = page.viewportSize()!
  const last = (await portal.boundingBox())!
  expect(last.x).toBeCloseTo(0, 0)
  expect(last.y).toBeCloseTo(0, 0)
  expect(last.width).toBeGreaterThanOrEqual(viewport.width - 1)
  expect(last.height).toBeGreaterThanOrEqual(viewport.height - 1)
})

test('every part of the teleport has finished, on a dark screen, before the tour opens', async ({ page }) => {
  await asStudent(page)
  const link = await openTourPage(page)
  await link.click()
  await expect(page.locator('.teleport.is-playing')).toBeAttached()
  const parts = await page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => (a.effect as KeyframeEffect | null)?.target?.closest('.teleport'))
      .map((a) => {
        const effect = a.effect as KeyframeEffect
        const frames = effect.getKeyframes()
        return { end: effect.getComputedTiming().endTime as number, cls: effect.target!.className, last: frames[frames.length - 1] }
      }),
  )
  const TELEPORT_MS = 1100
  for (const p of parts) expect(p.end, p.cls).toBeLessThanOrEqual(TELEPORT_MS - 100)
  const fade = parts.find((p) => p.cls === 'teleport__fade')!
  expect(fade.last.opacity).toBe('1')
})

test('the admin can open the office tour and the team tools from their section list', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByRole('button', { name: 'use the demo admin account' }).click()
  await page.getByRole('button', { name: 'Sign in' }).click()
  const nav = page.getByRole('navigation', { name: 'Admin sections' })
  await expect(nav.getByRole('link', { name: 'Slack (opens in a new tab)' })).toHaveAttribute('target', '_blank')
  await expect(nav.getByRole('link', { name: 'GitLab (opens in a new tab)' })).toHaveAttribute('target', '_blank')
  await nav.getByRole('link', { name: 'Office tour' }).click()
  await expect(page).toHaveURL(/\/admin\/office-tour$/)
  await expect(page.getByRole('heading', { name: 'Welcome to your office' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
