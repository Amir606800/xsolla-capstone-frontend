import { render as plainRender, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import SuperAdminPage from './SuperAdminPage'
import { initialState, superAdminReducer, unassigned } from './superAdminState'

const dialog = () => screen.findByRole('dialog')
// the cohort cards link to their pages
const render = (ui: ReactElement) => plainRender(<MemoryRouter>{ui}</MemoryRouter>)

describe('super admin state', () => {
  it('a cohort has many coordinators, and removing a coordinator takes them out of every cohort', () => {
    let s = superAdminReducer(initialState, { type: 'assign', cohortId: 'h1', coordinatorIds: ['c1', 'c2', 'c4', 'c4'] })
    expect(s.cohorts[0].coordinatorIds).toEqual(['c1', 'c2', 'c4'])
    s = superAdminReducer(s, { type: 'addCoordinator', name: 'Sam Lee', email: 'sam@x.az', cohortIds: ['h1', 'h2'] })
    expect(s.cohorts.map((h) => h.coordinatorIds.includes('c6'))).toEqual([true, true, false])
    s = superAdminReducer(s, { type: 'removeCoordinator', id: 'c1' })
    expect(s.coordinators.some((c) => c.id === 'c1')).toBe(false)
    expect(s.cohorts.every((h) => !h.coordinatorIds.includes('c1'))).toBe(true)
    expect(unassigned(initialState).map((c) => c.id)).toEqual(['c5'])
  })
})

describe('the super admin dashboard', () => {
  it('starts with the Baku, Kuala Lumpur and California cohorts, each with the picture of its office', () => {
    render(<SuperAdminPage />)
    const baku = within(screen.getByRole('article', { name: 'Xsolla School Baku' }))
    expect(baku.getByText('Baku, Azerbaijan')).toBeInTheDocument()
    expect(within(baku.getByRole('list', { name: 'Coordinators of Xsolla School Baku' })).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('article', { name: 'Xsolla School Kuala Lumpur' })).toHaveTextContent('Malaysia')
    expect(screen.getByRole('article', { name: 'Xsolla School California' })).toHaveTextContent('United States')
    for (const name of ['Xsolla School Baku', 'Xsolla School Kuala Lumpur', 'Xsolla School California']) {
      expect(screen.getByRole('article', { name }).querySelector('img')).toBeInTheDocument()
    }
  })

  it('opens the Baku cohort at its admin sign-in; a cohort without a page is not a link', () => {
    render(<SuperAdminPage />)
    expect(screen.getByRole('link', { name: 'Open Xsolla School Baku' })).toHaveAttribute('href', '/admin/login')
    expect(screen.queryByRole('link', { name: 'Open Xsolla School Kuala Lumpur' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Xsolla School Kuala Lumpur' })).getByText('Page not built yet')).toBeInTheDocument()
  })

  it('adds a cohort, adds a coordinator and gives the cohort several coordinators', async () => {
    const user = userEvent.setup()
    render(<SuperAdminPage />)

    await user.click(screen.getByRole('button', { name: 'Add cohort' }))
    const cohort = within(await dialog())
    await user.click(cohort.getByRole('button', { name: 'Add cohort' }))
    expect(cohort.getByText(/Enter the cohort name/)).toBeInTheDocument() // nothing is added without a name
    await user.type(cohort.getByLabelText('Cohort name'), 'Xsolla School Almaty')
    await user.type(cohort.getByLabelText('Country'), 'Kazakhstan')
    await user.type(cohort.getByLabelText('City'), 'Almaty')
    await user.click(cohort.getByRole('button', { name: 'Add cohort' }))
    expect(await screen.findByText(/Xsolla School Almaty added/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add coordinator' }))
    const person = within(await dialog())
    await user.type(person.getByLabelText('Full name'), 'Aysel Karimova')
    await user.type(person.getByLabelText('E-mail'), 'admin@xsolla.school')
    await user.click(person.getByRole('button', { name: 'Add coordinator' }))
    expect(person.getByText('There is already a coordinator with this e-mail.')).toBeInTheDocument()
    await user.clear(person.getByLabelText('E-mail'))
    await user.type(person.getByLabelText('E-mail'), 'aysel.karimova@xsolla.school')
    await user.click(person.getByRole('button', { name: 'Add coordinator' }))
    expect(await screen.findByText('Aysel Karimova added as a coordinator.')).toBeInTheDocument()

    // two coordinators for the new cohort
    await user.click(within(screen.getByRole('article', { name: 'Xsolla School Almaty' })).getByRole('button', { name: 'Assign coordinators' }))
    const assign = within(await dialog())
    await user.click(assign.getByRole('checkbox', { name: /Aysel Karimova/ }))
    await user.click(assign.getByRole('checkbox', { name: /Aidana Sarsenova/ }))
    await user.click(assign.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Xsolla School Almaty now has 2 coordinators.')).toBeInTheDocument()
    const almaty = within(screen.getByRole('article', { name: 'Xsolla School Almaty' }))
    expect(within(almaty.getByRole('list', { name: /Coordinators of/ })).getAllByRole('listitem')).toHaveLength(2)
  })

  it('removes a coordinator only after a confirmation, and they leave their cohorts', async () => {
    const user = userEvent.setup()
    render(<SuperAdminPage />)
    await user.click(screen.getByRole('button', { name: 'Remove Nigar Mammadova' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Remove coordinator' }))
    expect(await screen.findByText('Nigar Mammadova was removed.')).toBeInTheDocument()
    const baku = within(screen.getByRole('article', { name: 'Xsolla School Baku' }))
    expect(within(baku.getByRole('list', { name: /Coordinators of/ })).getAllByRole('listitem')).toHaveLength(1)
  })
})
