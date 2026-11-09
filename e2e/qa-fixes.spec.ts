import { expect, test } from '@playwright/test'

test('no font is requested that the server answers with a web page', async ({ page }) => {
  const warnings: string[] = []
  const wrong: string[] = []
  page.on('console', (m) => /OTS parsing|Failed to decode downloaded font/.test(m.text()) && warnings.push(m.text()))
  page.on('response', (r) => {
    if (/\/fonts\//.test(r.url()) && (r.headers()['content-type'] ?? '').includes('text/html')) wrong.push(r.url())
  })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  expect(wrong).toEqual([])
  expect(warnings).toEqual([])
})

test('the login says what is wrong with a field as soon as it is left', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('test')
  await expect(page.getByText('Enter a valid email address')).toHaveCount(0)
  await page.getByLabel('Email').blur()
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeDisabled()
})

test.describe('very long or odd names and e-mail addresses cannot break the admin tables', () => {
  const zalgo = `Ann${'ภิิิิิิิิิ'.repeat(30)} Lee 💩`
  const long = `h@gmail.${'com.az.'.repeat(30)}com`

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ([name, email]) => {
        localStorage.setItem('school_directory', JSON.stringify({ added: [{ id: 3000, name, email, roles: ['student'] }], teamOf: {}, changed: {}, left: {}, deleted: [], roles: {}, mentorOf: {} }))
      },
      [zalgo, long],
    )
    await page.goto('/admin/login')
    await page.getByRole('button', { name: 'use the demo admin account' }).click()
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('link', { name: 'Students' }).click()
    await expect(page.getByRole('table', { name: 'Students' })).toBeVisible()
  })

  test('the row stays one line high, the actions stay inside the table, the full text is the tooltip', async ({ page, isMobile }) => {
    const row = page.getByRole('row', { name: /^Ann/ })
    const normal = page.getByRole('row', { name: /Ali Abbasov|Leyla Hasanova/ }).first()
    const h = (await row.boundingBox())!.height
    const h0 = (await normal.boundingBox())!.height
    expect(h).toBeLessThanOrEqual(h0 + 8)

    const wrap = page.locator('.admin-table-wrap')
    const box = (await wrap.boundingBox())!
    const del = (await row.getByRole('button', { name: /^Delete / }).boundingBox())!
    // (on a phone the table scrolls sideways inside its box by design: only the page itself must not overflow)
    if (!isMobile) expect(del.x + del.width).toBeLessThanOrEqual(box.x + box.width + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)

    await expect(row.locator('a.admin-cell')).toHaveAttribute('title', long)
    await expect(row.locator('span.admin-cell')).toHaveAttribute('title', zalgo)
    // the glyphs are clipped to the cell: nothing is drawn above the row
    const cell = (await row.locator('span.admin-cell').boundingBox())!
    expect(cell.height).toBeLessThanOrEqual(h)
  })

  test('also on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
  })
})
