import { expect, test } from '@playwright/test'

type Pg = import('@playwright/test').Page
/** Opens the search the way a user of that screen size would: the bar on desktop, the icon on a phone. */
const openSearch = (page: Pg, isMobile: boolean) =>
  isMobile
    ? page.getByRole('button', { name: 'Search', exact: true }).click()
    : page.locator('.search-trigger').click()

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role: 'student' }))
  })
  await page.goto('/dashboard')
  await expect(page.getByRole('banner')).toBeVisible()
})

test.describe('header balance (desktop)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop layout')
  })

  test('the logo and the right-hand buttons are the same distance from the screen edges', async ({ page }) => {
    const vp = page.viewportSize()!
    const logo = (await page.locator('.header__logo').boundingBox())!
    const user = (await page.getByRole('button', { name: 'Account menu' }).boundingBox())!

    const left = logo.x
    const right = vp.width - (user.x + user.width)
    expect(Math.abs(left - right)).toBeLessThanOrEqual(2)
    expect(left).toBeGreaterThanOrEqual(20) // lines up with the sidebar icons, not hugging the edge
  })

  test('the search bar is centred in the header', async ({ page }) => {
    const vp = page.viewportSize()!
    const bar = (await page.locator('.search-trigger').boundingBox())!
    const barCentre = bar.x + bar.width / 2
    expect(Math.abs(barCentre - vp.width / 2)).toBeLessThanOrEqual(2)
    expect(bar.width).toBeGreaterThan(300) // a real search field, not a lonely icon
  })

  test('the header is no longer empty: brand, search, current module and actions', async ({ page }) => {
    await expect(page.locator('.header__logo')).toBeVisible()
    await expect(page.locator('.search-trigger')).toBeVisible()
    await expect(page.getByRole('link', { name: /Current module/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Notifications/ })).toBeVisible()
  })

  test('there is no redundant search icon between the current-module chip and the theme button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeHidden()
    await expect(page.getByRole('link', { name: /Current module/ })).toBeVisible() // wait for the data to load
    await expect(page.getByRole('button', { name: 'Notifications, 4 unread' })).toBeVisible()
    // order on the right: chip, theme, bell, account - nothing in between
    const names = await page
      .locator('.header__actions > *:visible')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.className))
    expect(names).toEqual(['Current module: Go Basics', 'Toggle theme', expect.stringMatching(/^Notifications/), 'header__user'])
  })

  test('"School Baku" stays on one line', async ({ page }) => {
    const box = (await page.locator('.header__org-name').boundingBox())!
    expect(box.height).toBeLessThan(24)
  })

  test('the brand, search and actions do not overlap', async ({ page }) => {
    const brand = (await page.locator('.header__brand').boundingBox())!
    const search = (await page.locator('.search-trigger').boundingBox())!
    const actions = (await page.locator('.header__actions').boundingBox())!
    expect(brand.x + brand.width).toBeLessThanOrEqual(search.x)
    expect(search.x + search.width).toBeLessThanOrEqual(actions.x)
  })
})

test.describe('sidebar look (desktop)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'desktop layout')
  })

  test('the active item is a flat highlighted row with a thin accent bar', async ({ page }) => {
    const active = page.locator('.sidebar__link.is-active')
    await expect(active).toHaveCount(1)
    const marker = await active.evaluate((el) => getComputedStyle(el, '::before').content)
    expect(marker).not.toBe('none')
    const bg = await active.evaluate((el) => getComputedStyle(el).backgroundColor)
    const idle = await page
      .locator('.sidebar__link:not(.is-active)')
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(bg).not.toBe(idle)
  })

  test('the sidebar is a flat panel: no gradient, no shadow', async ({ page }) => {
    const s = await page.getByRole('complementary', { name: 'Sidebar' }).evaluate((el) => {
      const c = getComputedStyle(el)
      return { image: c.backgroundImage, shadow: c.boxShadow }
    })
    expect(s.image).toBe('none')
    expect(s.shadow).toBe('none')
  })

  test('shows the program progress card, and hides it when the rail is collapsed', async ({ page }) => {
    await expect(page.getByRole('progressbar', { name: 'Program progress' })).toBeVisible()
    await expect(page.getByText('Week 6 of 12')).toBeVisible()
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(page.getByText('Week 6 of 12')).toBeHidden()
  })

  test('the sidebar still fits the screen and the collapsed rail keeps icons clickable', async ({ page }) => {
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.getByRole('link', { name: 'Calendar' }).click()
    await expect(page).toHaveURL(/\/calendar$/)
    const box = (await page.getByRole('complementary', { name: 'Sidebar' }).boundingBox())!
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height)
  })
})

test.describe('search', () => {
  test('Ctrl+K opens it with the search box focused, typing filters, Enter opens a result', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut')
    await page.keyboard.press('Control+k')
    const box = page.getByRole('combobox')
    await expect(box).toBeFocused()

    await box.fill('calendar')
    await expect(page.getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/calendar$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('arrow keys move through results', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard')
    await page.keyboard.press('Control+k')
    await page.getByRole('combobox').fill('go')
    const selected = page.locator('[role="option"][aria-selected="true"]')
    await expect(selected).toHaveCount(1)
    const first = await selected.textContent()
    await page.keyboard.press('ArrowDown')
    await expect(selected).not.toHaveText(first!)
  })

  test('future modules and their tasks cannot be found by a student', async ({ page, isMobile }) => {
    await openSearch(page, isMobile)
    await page.getByRole('combobox').fill('docker')
    await expect(page.getByRole('option')).toHaveCount(0)
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('No results')
  })

  test('works on a phone through the search icon', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone only')
    await expect(page.locator('.search-trigger')).toBeHidden()
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await expect(page.getByRole('combobox')).toBeFocused()
    await page.getByRole('combobox').fill('http')
    await page.getByRole('option').first().click()
    await expect(page).toHaveURL(/\/courses\/m6$/)
  })

  test('the search pop-up fits the screen', async ({ page, isMobile }) => {
    await openSearch(page, isMobile)
    const box = (await page.locator('.modal').boundingBox())!
    const vp = page.viewportSize()!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  })
})

test('glows are subtle: no strong halo around the sidebar or the current module', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop')
  const glow = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--glow').trim())
  expect(parseInt(glow)).toBeLessThanOrEqual(25)
  // the marker next to the active item has no shadow at all
  const marker = await page
    .locator('.sidebar__link.is-active')
    .evaluate((el) => getComputedStyle(el, '::before').boxShadow)
  expect(marker).toBe('none')
})

test('no horizontal overflow with the new header and sidebar, light and dark', async ({ page }) => {
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await overflow()).toBe(false)
  await page.getByRole('button', { name: 'Toggle theme' }).click()
  expect(await overflow()).toBe(false)
})
