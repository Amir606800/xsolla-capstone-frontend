import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendReport } from '../../api/reports'
import App from '../../App'
import { listReports } from '../../mocks/reports'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../../api/reports', async (importActual) => {
  const actual = await importActual<typeof import('../../api/reports')>()
  return { ...actual, sendReport: vi.fn(actual.sendReport) }
})

beforeEach(() => {
  vi.mocked(sendReport).mockClear()
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam Student', email: 'student@xsolla.school', roles: ['student'] }))
})

const dialog = () => screen.getByRole('dialog', { name: 'Report a problem' })

describe('Report a problem', () => {
  it('the red flag in the header opens the form; a report goes to the admins with what it is about', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/dashboard' })
    await user.click(await screen.findByRole('button', { name: 'Report a problem' }))

    // nothing is sent until it says what it is about, with a title and what happened
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }))
    expect(within(dialog()).getByText('Pick what the report is about.')).toBeInTheDocument()
    expect(sendReport).not.toHaveBeenCalled()

    await user.click(within(dialog()).getByRole('radio', { name: /A mentor/ }))
    await user.type(within(dialog()).getByLabelText(/^Who/), 'Rashad Aliyev')
    await user.type(within(dialog()).getByLabelText('Title'), 'Missed two 1:1s')
    await user.type(within(dialog()).getByLabelText('What happened?'), 'He did not come to our last two 1:1s.')
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }))

    expect(await within(dialog()).findByText('Report sent')).toBeInTheDocument()
    expect(sendReport).toHaveBeenCalledWith(
      'A mentor: Rashad Aliyev · Missed two 1:1s',
      'About: A mentor (Rashad Aliyev)\n\nHe did not come to our last two 1:1s.',
      { id: 1, name: 'Sam Student' },
    )
    expect(listReports()[0]).toMatchObject({ subject: 'A mentor: Rashad Aliyev · Missed two 1:1s', status: 'open' })
    await user.click(within(dialog()).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says what went wrong when the server refuses it, and keeps what was written', async () => {
    vi.mocked(sendReport).mockRejectedValueOnce(new Error('Subject must be at most 200 characters'))
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/profile' })
    // the card on the Profile page opens the same form
    const card = await screen.findByRole('region', { name: 'Report a problem' })
    await user.click(within(card).getByRole('button', { name: 'Report a problem' }))
    await user.click(within(dialog()).getByRole('radio', { name: /The school/ }))
    await user.type(within(dialog()).getByLabelText('Title'), 'Broken heating')
    await user.type(within(dialog()).getByLabelText('What happened?'), 'Room 3 is cold.')
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }))
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Subject must be at most 200 characters')
    expect(within(dialog()).getByLabelText('Title')).toHaveValue('Broken heating')
  })
})
