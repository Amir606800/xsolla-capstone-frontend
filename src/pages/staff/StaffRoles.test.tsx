import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { listModules, setLecturer } from '../../mocks/contentEdits'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { Role } from '../../types/user'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => vi.useRealTimers())

const ACCOUNTS: Record<string, { id: number; name: string; roles: Role[] }> = {
  both: { id: 900, name: 'Rashad Aliyev', roles: ['mentor', 'lecturer'] },
  mentor: { id: 901, name: 'Aysel Mammadova', roles: ['mentor'] },
  lecturer: { id: 902, name: 'Elvin Huseynov', roles: ['lecturer'] },
}

function renderAs(who: keyof typeof ACCOUNTS, route = '/dashboard') {
  localStorage.setItem('auth_user', JSON.stringify({ ...ACCOUNTS[who], email: `${who}@xsolla.school` }))
  return renderWithProviders(<App />, { route })
}

const nav = () => screen.getByRole('navigation', { name: 'Main navigation' })
const dashboard = async () => screen.findByRole('navigation', { name: 'Quick actions' }, { timeout: 4000 })

describe('one staff dashboard, sections by role', () => {
  it('mentor + lecturer: team card and the course cards, all shortcuts, both nav items', async () => {
    // the add shortcuts are for modules assigned to the lecturer: give Rashad them all here
    for (const m of listModules(new Date(2026, 10, 4, 12))) setLecturer(m.id, 900, true, new Date(2026, 10, 4, 12))
    renderAs('both')
    const actions = await dashboard()
    expect(within(actions).getByRole('link', { name: 'New task' })).toBeInTheDocument()
    expect(within(actions).getByRole('link', { name: 'Set 1:1 times' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'My team · Team 3' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Course content' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'My team' })).toBeInTheDocument()
    expect(screen.getByText('Mentor & lecturer')).toBeInTheDocument()
  })

  it('mentor only: the team, no course authoring', async () => {
    renderAs('mentor')
    const actions = await dashboard()
    expect(within(actions).queryByRole('link', { name: 'New task' })).not.toBeInTheDocument()
    expect(within(actions).getByRole('link', { name: 'Set 1:1 times' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'My team · Team 4' }, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Needs attention' })).not.toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: 'Course content' })).not.toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'My team' })).toBeInTheDocument()
  })

  it('lecturer only: the course, no team', async () => {
    renderAs('lecturer')
    const actions = await dashboard()
    expect(within(actions).getByRole('link', { name: 'New task' })).toBeInTheDocument()
    expect(within(actions).queryByRole('link', { name: 'Set 1:1 times' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Needs attention' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /My team/ })).not.toBeInTheDocument()
    expect(within(nav()).queryByRole('link', { name: 'My team' })).not.toBeInTheDocument()
  })

  it('an old saved session with role "teacher" still gets both parts', async () => {
    localStorage.setItem('auth_user', JSON.stringify({ id: 900, name: 'Rashad Aliyev', email: 'r@x', role: 'teacher' }))
    renderWithProviders(<App />, { route: '/dashboard' })
    expect(await screen.findByRole('heading', { name: 'My team · Team 3' }, { timeout: 4000 })).toBeInTheDocument()
  })
})

describe('pages are guarded by role', () => {
  it('a mentor sees their students and who booked a 1:1', async () => {
    renderAs('both', '/team')
    expect(await screen.findByRole('heading', { name: 'My team', level: 1 })).toBeInTheDocument()
    const students = await screen.findByRole('list', { name: 'Students' })
    expect(within(students).getAllByRole('listitem')).toHaveLength(5)
    expect(within(students).getByText('Sam Student')).toBeInTheDocument()
    // the demo seed: Leyla booked the first time next Thursday
    const booked = await screen.findByRole('list', { name: 'Booked 1:1s' })
    expect(booked).toHaveTextContent('Leyla Hasanova')
  })

  it('a lecturer who is no mentor is sent away from /team', async () => {
    renderAs('lecturer', '/team')
    expect(await screen.findByRole('navigation', { name: 'Quick actions' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'My team', level: 1 })).not.toBeInTheDocument()
  })

  it('a mentor who is no lecturer is sent away from the course editor', async () => {
    renderAs('mentor', '/courses/m6')
    expect(await screen.findByRole('navigation', { name: 'Quick actions' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Module 6/ })).not.toBeInTheDocument()
  })
})
