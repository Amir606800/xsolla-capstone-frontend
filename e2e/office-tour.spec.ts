import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] })),
  )
})

const overflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test('the play button appears when the preview is hovered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch screens show it all the time')
  await page.goto('/office-tour')
  const tour = page.getByRole('link', { name: 'Start the 360° office tour' })
  const play = tour.locator('.tour__play')
  await expect(play).toHaveCSS('opacity', '0')
  await tour.hover()
  await expect(play).toHaveCSS('opacity', '1')
})

test('the office tour page fits the screen in light and dark', async ({ page }) => {
  await page.goto('/office-tour')
  await expect(page.getByRole('heading', { name: 'Welcome to your office' })).toBeVisible()
  expect(await overflow(page)).toBe(false)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  expect(await overflow(page)).toBe(false)
})

test('clicking the preview teleports to the tour in the same tab', async ({ page }) => {
  await page.goto('/office-tour')
  const link = page.getByRole('link', { name: 'Start the 360° office tour' })
  // the address comes from VITE_OFFICE_TOUR_URL (or the placeholder): answer it with a stand-in page
  const tourUrl = new URL((await link.getAttribute('href'))!)
  await page.route(`${tourUrl.origin}/**`, (r) => r.fulfill({ contentType: 'text/html', body: '<h1>The tour</h1>' }))
  await link.click()
  await expect(page.getByRole('status')).toHaveText('Teleporting to the office…')
  await page.waitForURL(`${tourUrl.origin}/**`)
  await expect(page.getByRole('heading', { name: 'The tour' })).toBeVisible()
})
