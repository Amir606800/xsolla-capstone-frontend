import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
    )
  })
})

test.describe('sidebar collapse (desktop)', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'the collapse rail only exists on wide screens')
  })

  test('shrinks to an icon rail and expands again', async ({ page }) => {
    await page.goto('/dashboard')
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
    const wide = (await sidebar.boundingBox())!.width
    expect(wide).toBeGreaterThan(250)

    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(100)
    // labels are hidden but the links still work and keep their names
    await expect(page.getByRole('link', { name: 'My courses' }).locator('.sidebar__text')).toBeHidden()

    await page.getByRole('link', { name: 'My courses' }).click()
    await expect(page).toHaveURL(/\/courses$/)

    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(250)
    await expect(page.getByRole('link', { name: 'My courses' }).locator('.sidebar__text')).toBeVisible()
  })

  test('main content grows into the freed space', async ({ page }) => {
    await page.goto('/dashboard')
    const main = page.getByRole('main')
    const before = (await main.boundingBox())!.width
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect.poll(async () => (await main.boundingBox())!.width).toBeGreaterThan(before + 150)
  })

  test('remembers the choice after a reload', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('button', { name: 'Collapse sidebar' }).click()
    await page.reload()
    await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveClass(/is-collapsed/)
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
  })
})

test('on small screens there is no collapse button and the drawer stays full width', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only')
  await page.addInitScript(() => localStorage.setItem('sidebar', 'collapsed'))
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
  await expect(sidebar).toBeVisible()
  expect((await sidebar.boundingBox())!.width).toBeGreaterThan(250)
  await expect(page.getByRole('link', { name: 'My courses' }).locator('.sidebar__text')).toBeVisible()
  await expect(page.getByRole('button', { name: /sidebar$/ })).toBeHidden()
})

test.describe('courses grid / list', () => {
  test('list shows one module per row, grid shows several', async ({ page, isMobile }) => {
    await page.goto('/courses')
    const cards = page.locator('.module-cards .module-card') // open and locked cards alike
    await expect(cards).toHaveCount(12)

    const y = async (i: number) => (await cards.nth(i).boundingBox())!.y

    if (!isMobile) {
      // grid: first cards share a row
      expect(Math.abs((await y(0)) - (await y(1)))).toBeLessThan(2)
    }

    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'List' }).click()
    // list: every card sits below the previous one
    expect(await y(1)).toBeGreaterThan(await y(0) + 40)
    expect(await y(2)).toBeGreaterThan(await y(1) + 40)

    if (!isMobile) {
      // desktop list rows are short (one line of content), not tall cards
      const h = (await cards.nth(0).boundingBox())!.height
      expect(h).toBeLessThan(120)
    }
  })

  test('layout choice survives a reload and a visit to a module', async ({ page }) => {
    await page.goto('/courses')
    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'List' }).click()
    await page.reload()
    await expect(page.getByRole('list', { name: 'Modules' })).toHaveClass(/module-cards--list/)

    await page.getByRole('link', { name: /Module 2/ }).click()
    await expect(page).toHaveURL(/\/courses\/m2$/)
    await page.goBack()
    await expect(page.getByRole('list', { name: 'Modules' })).toHaveClass(/module-cards--list/)
  })

  test('no horizontal overflow in list view', async ({ page }) => {
    await page.goto('/courses')
    await page.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'List' }).click()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflow).toBe(false)
  })
})
