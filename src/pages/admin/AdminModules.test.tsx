import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as courses from '../../api/courses'
import App from '../../App'
import { listModules } from '../../mocks/contentEdits'
import { renderWithProviders } from '../../test/renderWithProviders'

beforeEach(() => {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1000, name: 'School Admin', email: 'admin@xsolla.school', roles: ['admin'] }))
})

const table = () => screen.findByRole('table', { name: 'Modules' })
const dialog = () => screen.findByRole('dialog')

describe('Admin: all modules', () => {
  it('lists every module with its lecturer, contents and status', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const rows = within(await table()).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(12)
    const first = within(rows[0])
    expect(first.getByRole('link', { name: 'Onboarding & Git' })).toHaveAttribute('href', '/admin/modules/m1')
    // names come from the directory (Rashad writes odd weeks, Elvin even ones)
    expect(await first.findByText('Rashad Aliyev')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Elvin Huseynov')).toBeInTheDocument()
    expect(first.getByText('2 tasks · 2 resources · 0 quizzes')).toBeInTheDocument()
    expect(first.getByText('Finished')).toBeInTheDocument()
    expect(within(rows[5]).getByText('Running now')).toBeInTheDocument()
    expect(within(rows[11]).getByText('Upcoming')).toBeInTheDocument()
  })

  it('edits a module’s title', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Edit Docker' }))
    const form = within(await dialog())
    await user.clear(form.getByLabelText('Title'))
    await user.type(form.getByLabelText('Title'), 'Containers')
    await user.click(form.getByRole('button', { name: 'Save module' }))
    expect(await screen.findByRole('link', { name: 'Containers' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Module saved.')
    expect(listModules().find((m) => m.id === 'm9')!.title).toBe('Containers')
  })

  it('deletes a module only after confirming, and says what goes with it', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Delete Testing' }))
    let confirm = within(await dialog())
    expect(confirm.getByRole('heading', { name: 'Delete “Testing”?' })).toBeInTheDocument()
    expect(confirm.getByText(/Module 10 is removed for everyone\. Its .* are deleted with it\. Work students already handed in is kept\./)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('link', { name: 'Testing' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete Testing' }))
    confirm = within(await dialog())
    await user.click(confirm.getByRole('button', { name: 'Delete module' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Testing' })).not.toBeInTheDocument())
    expect(screen.getByText('“Testing” deleted.')).toBeInTheDocument()
    expect(within(await table()).getAllByRole('row')).toHaveLength(12) // header + 11
  })

  it('a failed delete keeps the dialog open with the reason', async () => {
    vi.mocked(courses.deleteModule).mockRejectedValueOnce(new Error('You cannot delete this module'))
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Delete Testing' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Delete module' }))
    expect(await within(await dialog()).findByRole('alert')).toHaveTextContent('You cannot delete this module')
    expect(screen.getByRole('link', { name: 'Testing' })).toBeInTheDocument()
  })

  it('a student no longer sees a module the admin deleted', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'Delete Capstone' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Delete module' }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Capstone' })).not.toBeInTheDocument())
    expect(listModules().map((m) => m.title)).not.toContain('Capstone')
  })
})

describe('Admin: creating content', () => {
  async function createModule(user: ReturnType<typeof userEvent.setup>, title: string) {
    await table()
    await user.click(screen.getByRole('button', { name: 'New module' }))
    const form = within(await dialog())
    expect(form.getByRole('heading', { name: 'New module (Module 13)' })).toBeInTheDocument()
    await user.type(form.getByLabelText('Title'), title)
    fireEvent.change(form.getByLabelText('Opens on'), { target: { value: '2027-01-04' } })
    fireEvent.change(form.getByLabelText('Closes on'), { target: { value: '2027-01-10' } })
    await user.click(form.getByRole('button', { name: 'Create module' }))
  }

  it('creates a module after the last one and opens it, ready for content', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await createModule(user, 'Kubernetes')
    expect(await screen.findByRole('heading', { name: 'Kubernetes', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Module 13')).toBeInTheDocument()
    expect(screen.getByText('Module created. Add its tasks, resources and quizzes below.')).toBeInTheDocument()
    expect(screen.getByText('This module is empty.')).toBeInTheDocument()
    // the admin who made it is its creator
    expect(await within(screen.getByText('Lecturer', { selector: 'dt' }).closest('dl')!).findByText('School Admin')).toBeInTheDocument()
    expect(listModules().at(-1)).toMatchObject({ title: 'Kubernetes', position: 13, createdBy: 1000 })
  })

  it('the new module form checks the fields, and Cancel creates nothing', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await table()
    await user.click(screen.getByRole('button', { name: 'New module' }))
    const form = within(await dialog())
    await user.click(form.getByRole('button', { name: 'Create module' }))
    expect(form.getByText('Pick the day the module opens.')).toBeInTheDocument()
    await user.click(form.getByRole('button', { name: 'Cancel' }))
    expect(listModules()).toHaveLength(12)
  })

  it('adds a task and a link resource to a module', async () => {
    renderWithProviders(<App />, { route: '/admin/modules' })
    const user = userEvent.setup()
    await createModule(user, 'Kubernetes')
    await screen.findByRole('heading', { name: 'Kubernetes', level: 1 })

    await user.click(within(screen.getByRole('group', { name: 'Add content' })).getByRole('button', { name: 'New task' }))
    let form = within(await dialog())
    expect(form.getByRole('heading', { name: 'New task' })).toBeInTheDocument()
    await user.type(form.getByLabelText('Title'), 'Deploy an app')
    await user.click(form.getByRole('button', { name: 'Add task' }))
    expect(await screen.findByText('Task added.')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: 'View Deploy an app' }).closest('tr')!
    expect(within(row).getByText('School Admin')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New resource' }))
    form = within(await dialog())
    await user.type(form.getByLabelText('Title'), 'Kubernetes docs')
    await user.selectOptions(form.getByLabelText('Type'), 'Link')
    await user.type(form.getByLabelText('Link'), 'https://kubernetes.io/docs/')
    await user.click(form.getByRole('button', { name: 'Add material' }))
    expect(await screen.findByText('Resource added.')).toBeInTheDocument()
    expect(screen.getByText('Link · kubernetes.io')).toBeInTheDocument()

    const created = listModules().at(-1)!
    expect(created.items.map((i) => [i.type, i.title, i.createdBy])).toEqual([
      ['assignment', 'Deploy an app', 1000],
      ['resource', 'Kubernetes docs', 1000],
    ])
  })

  it('a new item shows up even while another type is filtered', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(within(await screen.findByRole('group', { name: 'Show' })).getByRole('button', { name: /^Quizzes/ }))
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const form = within(await dialog())
    await user.type(form.getByLabelText('Title'), 'Benchmarks')
    await user.click(form.getByRole('button', { name: 'Add task' }))
    expect(await screen.findByRole('button', { name: 'View Benchmarks' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Show' })).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the details pop-up has room around its content', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'View CLI tool' }))
    expect((await dialog()).querySelector('.admin-dialog')).not.toBeNull()
  })
})

describe('Admin: one module', () => {
  it('shows the module’s facts and all of its contents', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m5' })
    expect(await screen.findByRole('heading', { name: 'React', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Module 5')).toBeInTheDocument()
    const facts = screen.getByText('Lecturer', { selector: 'dt' }).closest('dl')!
    expect(await within(facts).findByText('Rashad Aliyev')).toBeInTheDocument()
    const m5 = listModules().find((m) => m.id === 'm5')!
    const rows = within(screen.getByRole('table', { name: 'Contents of React' })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(m5.items.length)
    // tasks first, then resources, then quizzes
    expect(within(rows[0]).getByText('Task')).toBeInTheDocument()
    expect(within(rows[rows.length - 1]).getByText('Quiz')).toBeInTheDocument()
    // quizzes in module 5 were written by Nargiz
    expect(within(rows[rows.length - 1]).getByText('Nargiz Abbasova')).toBeInTheDocument()
  })

  it('filters by type', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m5' })
    const user = userEvent.setup()
    const show = within(await screen.findByRole('group', { name: 'Show' }))
    await user.click(show.getByRole('button', { name: /^Quizzes/ }))
    expect(show.getByRole('button', { name: /^Quizzes/ })).toHaveAttribute('aria-pressed', 'true')
    const rows = within(screen.getByRole('table', { name: 'Contents of React' })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    for (const r of rows) expect(within(r).getByText('Quiz')).toBeInTheDocument()
    await user.click(show.getByRole('button', { name: /^All/ }))
    expect(within(screen.getByRole('table', { name: 'Contents of React' })).getAllByRole('row').length).toBeGreaterThan(4)
  })

  it('an empty filter says so', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m1' })
    const user = userEvent.setup()
    await user.click(within(await screen.findByRole('group', { name: 'Show' })).getByRole('button', { name: /^Quizzes/ }))
    expect(screen.getByText('No quizzes in this module.')).toBeInTheDocument()
  })

  it('a quiz’s details include every question and its correct answer', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m5' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'View Hooks basics' }))
    const d = within(await dialog())
    expect(d.getByRole('heading', { name: 'Hooks basics' })).toBeInTheDocument()
    expect(await d.findByText('Nargiz Abbasova')).toBeInTheDocument()
    expect(d.getByText('Which hook avoids recalculating an expensive value?')).toBeInTheDocument()
    const correct = d.getAllByText('(correct answer)')
    expect(correct).toHaveLength(5)
    expect(correct[0].closest('li')).toHaveTextContent('useState')
  })

  it('a task’s details list what to hand in; a resource’s show the file or link', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'View CLI tool' }))
    let d = within(await dialog())
    expect(d.getByRole('heading', { name: 'What to hand in' })).toBeInTheDocument()
    expect(d.getByText('Push your work to the team repository')).toBeInTheDocument()
    expect(await d.findByText('Elvin Huseynov')).toBeInTheDocument() // module 6 is an even week
    await user.click(d.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'View Go Basics - further reading' }))
    d = within(await dialog())
    expect(d.getByRole('link', { name: /developer\.mozilla\.org/ })).toHaveAttribute('target', '_blank')
    expect(d.getByText('Yes')).toBeInTheDocument() // students see it
    await user.click(d.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'View Go Basics - lecture slides' }))
    expect(within(await dialog()).getByRole('button', { name: 'Download Go Basics - lecture slides' })).toBeInTheDocument()
  })

  it('edits an item with the lecturer’s form and keeps who wrote it', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m5' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit Routing' }))
    const form = within(await dialog())
    expect(form.getByRole('heading', { name: 'Edit quiz' })).toBeInTheDocument()
    const title = form.getAllByLabelText(/^Title/)[0]
    await user.clear(title)
    await user.type(title, 'Routing check')
    await user.click(form.getByRole('button', { name: /^Save/ }))
    expect(await screen.findByRole('button', { name: 'View Routing check' })).toBeInTheDocument()
    expect(screen.getByText('Quiz saved.')).toBeInTheDocument()
    const saved = listModules().find((m) => m.id === 'm5')!.items.find((i) => i.id === 'm5-z3')!
    expect(saved).toMatchObject({ title: 'Routing check', createdBy: 907 })
  })

  it('opens the edit form from the details view', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'View CLI tool' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Edit' }))
    expect(within(await dialog()).getByRole('heading', { name: 'Edit task' })).toBeInTheDocument()
  })

  it('deletes an item after confirming', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete HTTP server' }))
    const confirm = within(await dialog())
    expect(confirm.getByText(/Work students already handed in is kept/)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Delete task' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'View HTTP server' })).not.toBeInTheDocument())
    expect(screen.getByText('“HTTP server” deleted.')).toBeInTheDocument()
    expect(listModules().find((m) => m.id === 'm6')!.items.some((i) => i.title === 'HTTP server')).toBe(false)
  })

  it('deleting the module goes back to the list with a message', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete module' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Delete module' }))
    expect(await screen.findByRole('heading', { name: 'Modules', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('“Go Basics” deleted.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Go Basics' })).not.toBeInTheDocument()
  })

  it('edits the module from its own page', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m6' })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit module' }))
    const form = within(await dialog())
    await user.clear(form.getByLabelText('Title'))
    await user.type(form.getByLabelText('Title'), 'Go')
    await user.click(form.getByRole('button', { name: 'Save module' }))
    expect(await screen.findByRole('heading', { name: 'Go', level: 1 })).toBeInTheDocument()
  })

  it('an unknown module says it was not found, with a way back', async () => {
    renderWithProviders(<App />, { route: '/admin/modules/m99' })
    expect(await screen.findByRole('heading', { name: 'Module not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All modules' })).toHaveAttribute('href', '/admin/modules')
  })
})
