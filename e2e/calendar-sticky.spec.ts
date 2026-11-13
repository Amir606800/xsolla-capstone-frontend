import { expect, test } from '@playwright/test'

const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', role: 'teacher' }

// on a wide screen the day panel sits beside the whole page and stays in view while the month scrolls
test('the day panel is level with the page title and stays in view when scrolling', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the side-by-side layout is for wide screens')
  await page.setViewportSize({ width: 1442, height: 600 })
  await page.addInitScript((u) => localStorage.setItem('auth_user', JSON.stringify(u)), LECTURER)
  await page.goto('/calendar')
  const panel = page.getByRole('region', { name: 'Day details' })
  const title = page.getByRole('heading', { name: 'Calendar', level: 1 })
  await expect(panel).toBeVisible()

  const top = async () => (await panel.boundingBox())!.y
  const titleTop = (await title.boundingBox())!.y
  // level with the title, not below the legend
  expect(Math.abs((await top()) - titleTop)).toBeLessThan(40)

  // the page is taller than the screen: scroll it and the panel keeps its place
  const scrolled = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement
    const main = document.querySelector('main')
    const target = main && main.scrollHeight > main.clientHeight ? main : el
    target.scrollTop = 300
    return target.scrollTop
  })
  expect(scrolled).toBeGreaterThan(0)
  {
    await page.waitForTimeout(200)
    // fully visible: below the app header, not hidden behind it
    const header = (await page.locator('header.header').boundingBox())!
    expect(await top()).toBeGreaterThanOrEqual(header.y + header.height)
    expect(await top()).toBeLessThan(header.y + header.height + 40)
  }
})
