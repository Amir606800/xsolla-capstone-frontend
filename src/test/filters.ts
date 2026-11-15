import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

/** Opens the "Filters" panel if it is closed, and returns it. */
export async function openFilters(user: User) {
  const button = await screen.findByRole('button', { name: /^Filters/ })
  if (button.getAttribute('aria-expanded') !== 'true') await user.click(button)
  return within(await screen.findByRole('group', { name: 'Filters' }))
}

/** Chooses one option of one list in the "Filters" panel (the panel stays open, as for a person). */
export async function pickFilter(user: User, list: string, option: string | RegExp) {
  const panel = await openFilters(user)
  const group = within(panel.getByRole('group', { name: list }))
  await user.click(group.getByRole('radio', { name: option }))
}

/** The panel's own "Clear filters". */
export async function clearFilters(user: User) {
  const panel = await openFilters(user)
  await user.click(panel.getByRole('button', { name: 'Clear filters' }))
}

/** The options of one list in the panel, as written. */
export async function filterOptions(user: User, list: string) {
  const panel = await openFilters(user)
  return within(panel.getByRole('group', { name: list }))
    .getAllByRole('radio')
    .map((r) => r.closest('label')?.textContent?.trim())
}
