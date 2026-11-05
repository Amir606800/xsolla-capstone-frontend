import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fetchModules } from '../api/courses'
import { CoursesProvider } from '../context/CoursesProvider'
import { renderWithProviders } from '../test/renderWithProviders'
import TasksPage from './TasksPage'

function renderTasks(route = '/tasks', role: 'student' | 'teacher' = 'student') {
  localStorage.setItem('auth_user', JSON.stringify({ id: 1, name: 'Sam', email: 's@x.co', role }))
  return renderWithProviders(
    <CoursesProvider>
      <TasksPage />
    </CoursesProvider>,
    { route },
  )
}

const list = () => within(screen.getByRole('region', { name: 'Tasks' }))
/** Waits until the tasks are on screen and returns their rows. */
const ready = () => screen.findByRole('region', { name: 'Tasks' }).then((r) => within(r).getAllByRole('listitem'))
const filterGroup = () => screen.getByRole('group', { name: 'Filter by status' })
const count = (name: string) => Number(within(screen.getByRole('button', { name: new RegExp(`^${name}`) })).getByText(/^\d+$/).textContent)

describe('TasksPage', () => {
  it('shows a loading state, then the tasks', async () => {
    renderTasks()
    expect(screen.getByRole('heading', { name: 'My tasks' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(await ready()).not.toHaveLength(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows an error with retry, and recovers', async () => {
    vi.mocked(fetchModules).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderTasks()
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await ready()).not.toHaveLength(0)
  })

  it('names the module of each task', async () => {
    renderTasks()
    const rows = await ready()
    expect(rows[0]).toHaveTextContent(/Module \d+ · /)
  })

  it('never lists tasks of modules that are not open yet (students)', async () => {
    renderTasks()
    await ready()
    expect(list().queryByText(/Schema design|Docker/)).not.toBeInTheDocument()
    const options = within(screen.getByRole('combobox')).getAllByRole('option')
    expect(options).toHaveLength(7) // "All modules" + modules 1-6
  })

  it('shows the whole course to a teacher', async () => {
    renderTasks('/tasks', 'teacher')
    await ready()
    expect(within(screen.getByRole('combobox')).getAllByRole('option')).toHaveLength(13)
  })

  it('puts overdue work first', async () => {
    renderTasks()
    const rows = await ready()
    expect(within(rows[0]).getByText('Overdue')).toBeInTheDocument()
  })

  it('has a count on each filter button, and they add up', async () => {
    renderTasks()
    await ready()
    expect(count('All')).toBe(count('To do') + count('Overdue') + count('Submitted') + count('Graded'))
    expect(count('All')).toBe(screen.getAllByRole('listitem').filter((li) => li.classList.contains('assignment')).length)
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    renderTasks()
    await ready()

    await user.click(within(filterGroup()).getByRole('button', { name: /^Overdue/ }))
    const rows = list().getAllByRole('listitem')
    expect(rows).toHaveLength(count('Overdue'))
    for (const row of rows) expect(within(row).getByText('Overdue')).toBeInTheDocument()
    expect(within(filterGroup()).getByRole('button', { name: /^Overdue/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(filterGroup()).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters by module, and the counts follow', async () => {
    const user = userEvent.setup()
    renderTasks()
    await ready()
    const all = count('All')

    await user.selectOptions(screen.getByRole('combobox'), 'm6')
    expect(count('All')).toBeLessThan(all)
    for (const row of list().getAllByRole('listitem')) expect(row).toHaveTextContent('Module 6')
  })

  it('opens from the address: ?status= and ?module=', async () => {
    renderTasks('/tasks?status=graded&module=m2')
    await ready()
    expect(within(filterGroup()).getByRole('button', { name: /^Graded/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('m2')
    for (const row of list().getAllByRole('listitem')) expect(row).toHaveTextContent('Module 2')
  })

  it('ignores a bad status or a module the student cannot open', async () => {
    renderTasks('/tasks?status=bogus&module=m9')
    await ready()
    expect(within(filterGroup()).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  it('says so when a filter has nothing to show', async () => {
    const user = userEvent.setup()
    renderTasks()
    await ready()
    await user.selectOptions(screen.getByRole('combobox'), 'm1')
    await user.click(within(filterGroup()).getByRole('button', { name: /^Overdue/ }))
    expect(list().getByText('Nothing is overdue.')).toBeInTheDocument()
  })

  it('opens a task to read it and hand in work', async () => {
    const user = userEvent.setup()
    renderTasks('/tasks?status=todo')
    const first = (await ready())[0]
    await user.click(within(first).getByRole('button'))
    expect(within(first).getByText('Requirements')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('moves a task to "Submitted" after handing it in', async () => {
    const user = userEvent.setup()
    renderTasks('/tasks?status=todo')
    const first = (await ready())[0]
    const todoBefore = count('To do')
    const submittedBefore = count('Submitted')

    await user.click(within(first).getAllByRole('button')[0])
    await user.type(within(first).getByLabelText('Answer or link'), 'https://github.com/team/repo')
    await user.click(within(first).getByRole('button', { name: 'Submit' }))

    await vi.waitFor(() => expect(count('To do')).toBe(todoBefore - 1))
    expect(count('Submitted')).toBe(submittedBefore + 1)
    expect(list().queryAllByRole('listitem')).toHaveLength(todoBefore - 1) // it left the "To do" list
  })
})
