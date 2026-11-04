import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }))
  })
})

const token = (page: import('@playwright/test').Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)

test('light theme uses the calmer colours', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.goto('/dashboard')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await token(page, '--xs-cyan')).toBe('#2aa9c2') // not the neon brand turquoise
  expect(await token(page, '--link')).toBe('#0a7088')
  expect(await token(page, '--danger')).toBe('#b83a28')
})

test('dark theme keeps the bright Xsolla colours', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto('/dashboard')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await token(page, '--xs-cyan')).toBe('#00c8f0')
  expect(await token(page, '--link')).toBe('#4fdcff')
})

test('link and stat text on the light dashboard is dark enough to read comfortably', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'))
  await page.goto('/dashboard')
  await page.getByRole('heading', { name: 'Progress' }).waitFor()
  const rgb = await page.locator('.stat__label').first().evaluate((el) => getComputedStyle(el).color)
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number)
  // old bright link colour was rgb(0, 169, 204); the new one is clearly darker
  expect(r + g + b).toBeLessThan(0 + 169 + 204 - 100)
})
