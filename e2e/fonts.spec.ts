import { expect, test } from '@playwright/test'

const FONT_URL = '**/fonts/sharp-grotesk/SharpGroteskBook20.woff2'
// A free font stands in for the licensed file, so we can prove the drop-in wiring works.
const STAND_IN = 'node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2'

const loadedFamilies = (page: import('@playwright/test').Page) =>
  page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, ''))
  })

test('SharpGrotesk20 comes first in the font stack', async ({ page }) => {
  await page.goto('/login')
  const stack = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  expect(stack.split(',')[0].trim().replace(/["']/g, '')).toBe('SharpGrotesk20')
  expect(stack).toContain('Hanken Grotesk Variable') // the safety net is still there
})

test('without the font files the page still renders with the stand-in font', async ({ page }) => {
  await page.route(FONT_URL, (route) => route.fulfill({ status: 404 }))
  await page.route('**/fonts/sharp-grotesk/SharpGroteskBook20.woff', (route) => route.fulfill({ status: 404 }))
  await page.route('**/fonts/sharp-grotesk/Sharp*Grotesk*Book*', (route) => route.fulfill({ status: 404 }))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()

  const families = await loadedFamilies(page)
  expect(families).toContain('Hanken Grotesk Variable')
  expect(families).not.toContain('SharpGrotesk20')
})

test('dropping the font file into public/fonts/sharp-grotesk/ is enough to use it', async ({ page }) => {
  await page.route(FONT_URL, (route) => route.fulfill({ path: STAND_IN, contentType: 'font/woff2' }))
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()

  await expect.poll(() => loadedFamilies(page)).toContain('SharpGrotesk20')
})

test('headings do not get a faux bold when only the Book weight exists', async ({ page }) => {
  await page.route(FONT_URL, (route) => route.fulfill({ path: STAND_IN, contentType: 'font/woff2' }))
  await page.goto('/login')
  await page.getByRole('heading', { name: 'Welcome' }).waitFor()
  const weights = await page.evaluate(() => {
    const rule = [...document.styleSheets]
      .flatMap((s) => [...s.cssRules])
      .find((r) => r instanceof CSSFontFaceRule && r.style.getPropertyValue('font-family').includes('SharpGrotesk20'))
    return (rule as CSSFontFaceRule).style.getPropertyValue('font-weight')
  })
  expect(weights).toBe('400 700') // one file covers 400-700, so the browser never synthesises bold
})

test('layout does not break with the font loaded (no horizontal overflow)', async ({ page }) => {
  await page.route(FONT_URL, (route) => route.fulfill({ path: STAND_IN, contentType: 'font/woff2' }))
  await page.goto('/login')
  await expect.poll(() => loadedFamilies(page)).toContain('SharpGrotesk20')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('titles use the headline font: h1 is Bold (700), card titles SemiBold (600)', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' })),
  )
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const info = await page.evaluate(async () => {
    await document.fonts.load('700 40px SharpGrotesk15')
    await document.fonts.load('600 20px SharpGrotesk15')
    const h1 = getComputedStyle(document.querySelector('h1')!)
    return {
      first: h1.fontFamily.split(',')[0].trim().replace(/["']/g, ''),
      weight: h1.fontWeight,
      loaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
    }
  })
  expect(info.first).toBe('SharpGrotesk15')
  expect(info.weight).toBe('700')
  expect(info.loaded).toEqual(expect.arrayContaining(['SharpGrotesk15 700', 'SharpGrotesk15 600']))
})
