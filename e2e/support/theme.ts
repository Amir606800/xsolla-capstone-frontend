import type { Page } from '@playwright/test'

/** Switches light/dark from the account menu (the theme switch lives there, not in the header bar). */
export async function toggleTheme(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: /^(Dark|Light) mode$/ }).click()
}
