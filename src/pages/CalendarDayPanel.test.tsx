import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

const LECTURER = { id: 901, name: 'Lena Lecturer', email: 'lena@xsolla.school', roles: ['lecturer'] }
const MENTOR = { id: 902, name: 'Marat Mentor', email: 'marat@xsolla.school', roles: ['mentor'] }
const BOTH = { id: 900, name: 'Rashad Aliyev', email: 'rashad@xsolla.school', roles: ['mentor', 'lecturer'] }

vi.setConfig({ testTimeout: 20_000 })

async function open(who: object) {
  localStorage.setItem('auth_user', JSON.stringify(who))
  const user = userEvent.setup()
  renderWithProviders(<App />, { route: '/calendar' })
  const panel = await screen.findByRole('region', { name: 'Day details' })
  return { user, panel: within(panel) }
}

describe('the staff day panel: what is on the day, and the buttons to add to it', () => {
  it('the add buttons sit in the header, one per thing the role can add, above the events', async () => {
    const { panel } = await open(BOTH)
    const group = panel.getByRole('group', { name: 'Add to this day' })
    expect(within(group).getByRole('button', { name: 'Add a lecture' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()
    // header first, then the events
    expect(group.compareDocumentPosition(panel.getByRole('heading', { name: 'On this day' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a lecturer can add lectures and events, but has no 1:1 times', async () => {
    const { panel } = await open(LECTURER)
    expect(panel.getByRole('button', { name: 'Add a lecture' })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Add 1:1 times' })).not.toBeInTheDocument()
  })

  it('a mentor can add 1:1 times, but no lectures', async () => {
    const { panel } = await open(MENTOR)
    expect(panel.getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(panel.queryByRole('button', { name: 'Add a lecture' })).not.toBeInTheDocument()
  })

  it('a button opens its form under the header; the buttons stay, and Cancel closes the form', async () => {
    const { user, panel } = await open(BOTH)
    await user.click(panel.getByRole('button', { name: 'Add a lecture' }))
    expect(panel.getByRole('heading', { name: 'New lecture' })).toBeInTheDocument()
    expect(panel.getByRole('form', { name: 'New lecture' })).toBeInTheDocument()
    // the events of the day stay in view, and so do the buttons
    expect(panel.getByRole('heading', { name: 'On this day' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Add 1:1 times' })).toBeInTheDocument()

    await user.click(panel.getByRole('button', { name: 'Cancel' }))
    expect(panel.queryByRole('form')).not.toBeInTheDocument()

    await user.click(panel.getByRole('button', { name: 'Add 1:1 times' }))
    expect(panel.getByRole('heading', { name: 'Add 1:1 times' })).toBeInTheDocument()
    expect(panel.getByLabelText('From')).toBeInTheDocument()
  })

  it('after an event is added the same button is there for the next one, as many times as needed', async () => {
    const { user, panel } = await open(LECTURER)
    for (const title of ['First talk', 'Second talk', 'Third talk']) {
      await user.click(panel.getByRole('button', { name: 'Add a lecture' }))
      await user.type(panel.getByLabelText('Title'), title)
      await user.click(panel.getByRole('button', { name: 'Add lecture' }))
      expect(await panel.findByText(title)).toBeInTheDocument()
      expect(panel.queryByRole('form')).not.toBeInTheDocument()
      expect(panel.getByRole('button', { name: 'Add a lecture' })).toBeEnabled()
    }
    expect(within(panel.getByRole('list', { name: 'Events' })).getAllByText(/ talk$/)).toHaveLength(3)
  })

  it('moving to another day drops a half-filled form and the old message', async () => {
    const { user, panel } = await open(BOTH)
    await user.click(panel.getByRole('button', { name: 'Add a lecture' }))
    await user.type(panel.getByLabelText('Title'), 'Draft')
    const grid = screen.getByRole('group', { name: 'Month view' })
    await user.click(within(grid).getByRole('button', { name: /^Monday, November 16/ }))
    expect(panel.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(panel.getByRole('heading', { name: 'Monday, November 16', level: 2 })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Add a lecture' })).toBeInTheDocument()
  })
})
