import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { removeItem } from '../../mocks/contentEdits'
import { renderWithProviders } from '../../test/renderWithProviders'

// "Today" is Wed 4 Nov 2026: module 6 (Go Basics) is running, module 7 opens next week.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
})
afterEach(() => {
  vi.useRealTimers()
})

const LECTURER = { id: 900, name: 'Rashad Aliyev', email: 'lecturer@xsolla.school', role: 'teacher' }
const STUDENT = { id: 1, name: 'Sam', email: 'student@xsolla.school', role: 'student' }

function renderAs(who: typeof LECTURER | typeof STUDENT, route: string) {
  localStorage.setItem('auth_user', JSON.stringify(who))
  return renderWithProviders(<App />, { route })
}

const dialog = () => screen.getByRole('dialog')
const status = async (text: string | RegExp) => expect(await screen.findByRole('status')).toHaveTextContent(text)

describe('Lecturer account', () => {
  it('the login page offers the offline demo accounts, and the lecturer lands on their dashboard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<App />, { route: '/login' })
    const demo = await screen.findByRole('group', { name: 'Demo accounts' })
    await user.click(within(demo).getByRole('button', { name: 'Mentor & lecturer' }))
    expect(screen.getByLabelText('Email')).toHaveValue('lecturer@xsolla.school')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'Welcome, Rashad Aliyev', level: 1 })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('auth_user')!).roles).toEqual(['mentor', 'lecturer'])
  })

  it('has its own navigation, without the student pages', async () => {
    renderAs(LECTURER, '/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getAllByRole('link').map((l) => l.getAttribute('aria-label'))).toEqual([
      'Dashboard',
      'Course content',
      'Calendar',
      'My team', // the demo lecturer is also Team 3's mentor
      'Grading',
      'Office tour',
    ])
  })

  it.each(['/tasks', '/grades'])('sends a lecturer away from the student page %s', async (route) => {
    renderAs(LECTURER, route)
    expect(await screen.findByRole('heading', { name: 'Welcome, Rashad Aliyev', level: 1 })).toBeInTheDocument()
  })

  it('shows none of the demo student notifications', async () => {
    renderAs(LECTURER, '/dashboard')
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })
})

describe('Lecturer dashboard', () => {
  it('shows the running module with what it holds', async () => {
    renderAs(LECTURER, '/dashboard')
    const tile = (await screen.findByRole('heading', { name: 'This week' })).closest('section')!
    expect(tile).toHaveTextContent('Module 6')
    expect(tile).toHaveTextContent('Go Basics')
    expect(tile).toHaveTextContent('2 materials · 2 tasks · 0 quizzes')
    expect(within(tile).getByRole('link')).toHaveAttribute('href', '/courses/m6')
  })

  it('has shortcuts to the things students depend on', async () => {
    renderAs(LECTURER, '/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Quick actions' })
    expect(within(nav).getByRole('link', { name: 'New task' })).toHaveAttribute('href', '/courses/m6?add=task')
    expect(within(nav).getByRole('link', { name: 'Add material' })).toHaveAttribute('href', '/courses/m6?add=material')
    expect(within(nav).getByRole('link', { name: 'New quiz' })).toHaveAttribute('href', '/courses/m6?add=quiz')
    expect(within(nav).getByRole('link', { name: 'Schedule a lecture' })).toHaveAttribute('href', '/calendar')
    expect(within(nav).getByRole('link', { name: 'Set 1:1 times' })).toHaveAttribute('href', '/calendar')
  })

  it('says everything is in place, or lists what is missing', async () => {
    const { unmount } = renderAs(LECTURER, '/dashboard')
    expect(await screen.findByText('The coming weeks are ready')).toBeInTheDocument()
    unmount()

    removeItem('m7-a1')
    removeItem('m7-a2')
    renderAs(LECTURER, '/dashboard')
    const list = await screen.findByRole('list', { name: 'Needs attention' })
    expect(list).toHaveTextContent('Module 7No tasks yet')
    expect(within(list).getByRole('link')).toHaveAttribute('href', '/courses/m7')
  })

  it('lists the next deadlines of every module, even ones not open to students yet', async () => {
    renderAs(LECTURER, '/dashboard')
    const list = await screen.findByRole('list', { name: 'Upcoming deadlines' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(5)
    expect(list).toHaveTextContent('HTTP server')
    expect(list).toHaveTextContent('Schema design') // module 7, still locked for students
  })

  it('shows what is coming up on the calendar, including booked 1:1s', async () => {
    renderAs(LECTURER, '/dashboard')
    const list = await screen.findByRole('list', { name: 'Coming up' })
    await waitFor(() => expect(list).toHaveTextContent('1:1 with Leyla Hasanova'))
    expect(list).toHaveTextContent('Team sync')
  })
})

describe('Course content', () => {
  it('lists the 12 modules with their phase and contents', async () => {
    renderAs(LECTURER, '/courses')
    expect(await screen.findByRole('heading', { name: 'Course content', level: 1 })).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Modules' })).getAllByRole('link')
    expect(rows).toHaveLength(12)
    expect(rows[0]).toHaveTextContent('Finished')
    expect(rows[5]).toHaveTextContent('Module 6 · Go Basics')
    expect(rows[5]).toHaveTextContent('Running now')
    expect(rows[5]).toHaveTextContent('2 materials · 2 tasks · 0 quizzes')
    expect(rows[6]).toHaveTextContent('Upcoming')
    expect(rows[8]).toHaveAttribute('href', '/courses/m9') // lecturers open every module
  })

  it('flags a module with missing content', async () => {
    removeItem('m8-r1')
    removeItem('m8-r2')
    renderAs(LECTURER, '/courses')
    const row = (await screen.findAllByRole('link', { name: /Module 8/ }))[0]
    expect(row).toHaveTextContent('1 thing to do')
  })
})

describe('Module editor: tasks', () => {
  it('adds a task that students then see in the module', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'New task' }))
    expect(dialog()).toHaveAccessibleName('New task')

    await user.type(within(dialog()).getByLabelText('Title'), 'Concurrency kata')
    await user.type(within(dialog()).getByLabelText(/What to hand in/), 'Push to the repo{enter}Explain your channels')
    fireEvent.change(within(dialog()).getByLabelText('Date'), { target: { value: '2026-11-07' } })
    await user.click(within(dialog()).getByRole('button', { name: 'Add task' }))

    await status('Task added.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const tasks = screen.getByRole('region', { name: 'Tasks' })
    expect(tasks).toHaveTextContent('Concurrency kata')
    expect(tasks).toHaveTextContent('2 requirements')
    unmount()

    renderAs(STUDENT, '/courses/m6')
    const assignments = await screen.findByRole('region', { name: 'Assignments' })
    expect(within(assignments).getByRole('button', { name: /Concurrency kata/ })).toBeInTheDocument()
  })

  it('explains what is missing instead of saving', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'New task' }))
    fireEvent.change(within(dialog()).getByLabelText('Time'), { target: { value: '' } })
    await user.click(within(dialog()).getByRole('button', { name: 'Add task' }))
    expect(within(dialog()).getByText('Give it a title.')).toBeInTheDocument()
    expect(within(dialog()).getByText('Pick a due date and time.')).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
  })

  it('warns when the deadline falls outside the module week', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'New task' }))
    fireEvent.change(within(dialog()).getByLabelText('Date'), { target: { value: '2026-11-20' } })
    expect(within(dialog()).getByRole('list', { name: 'Please check' })).toHaveTextContent('due after the module closes')
  })

  it('a link from the dashboard opens the form straight away', async () => {
    renderAs(LECTURER, '/courses/m6?add=task')
    expect(await screen.findByRole('dialog', { name: 'New task' })).toBeInTheDocument()
  })

  it('edits a task, keeping the work students handed in', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Edit CLI tool' }))
    expect(within(dialog()).getByText(/already handed in work/)).toBeInTheDocument()
    const title = within(dialog()).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'CLI tool (v2)')
    await user.click(within(dialog()).getByRole('button', { name: 'Save task' }))
    await status('Task saved.')
    unmount()

    renderAs(STUDENT, '/courses/m6')
    const card = await screen.findByRole('button', { name: /CLI tool \(v2\)/ })
    expect(card.closest('li')).toHaveTextContent('Submitted')
  })

  it('deletes a task only after a second click, and Keep cancels', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Delete HTTP server' }))
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('region', { name: 'Tasks' })).toHaveTextContent('HTTP server')

    await user.click(screen.getByRole('button', { name: 'Delete HTTP server' }))
    await user.click(within(screen.getByRole('group', { name: 'Delete HTTP server?' })).getByRole('button', { name: 'Yes, delete' }))
    await status('Task deleted.')
    expect(screen.getByRole('region', { name: 'Tasks' })).not.toHaveTextContent('HTTP server')
  })
})

describe('Module editor: materials', () => {
  it('adds a link, checking that it is a real web address', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.type(within(dialog()).getByLabelText('Title'), 'Effective Go')
    await user.selectOptions(within(dialog()).getByLabelText('Type'), 'link')
    await user.type(within(dialog()).getByLabelText('Link'), 'go.dev/doc')
    await user.click(within(dialog()).getByRole('button', { name: 'Add material' }))
    expect(within(dialog()).getByText(/starts with http/)).toBeInTheDocument()

    await user.clear(within(dialog()).getByLabelText('Link'))
    await user.type(within(dialog()).getByLabelText('Link'), 'https://go.dev/doc/effective_go')
    await user.click(within(dialog()).getByRole('button', { name: 'Add material' }))
    await status('Material added.')
    unmount()

    renderAs(STUDENT, '/courses/m6')
    expect(await screen.findByRole('link', { name: 'Open Effective Go' })).toHaveAttribute('href', 'https://go.dev/doc/effective_go')
  })

  it('a file needs a file', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.type(within(dialog()).getByLabelText('Title'), 'Week 6 slides')
    await user.click(within(dialog()).getByRole('button', { name: 'Add material' }))
    expect(within(dialog()).getByText('Choose a file to upload.')).toBeInTheDocument()

    await user.upload(within(dialog()).getByLabelText('File'), new File(['x'], 'week6.pdf', { type: 'application/pdf' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add material' }))
    await status('Material added.')
    expect(screen.getByRole('region', { name: 'Materials' })).toHaveTextContent('week6.pdf')
  })
})

describe('Module editor: quizzes (optional)', () => {
  it('builds a quiz; students see it exists, but never the answers', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'New quiz' }))
    await user.type(within(dialog()).getByLabelText('Title'), 'Go check')
    await user.type(within(dialog()).getByLabelText('Question 1 text'), 'What does := do?')
    await user.type(within(dialog()).getByLabelText('Question 1: answer 1'), 'Declares and assigns')
    await user.type(within(dialog()).getByLabelText('Question 1: answer 2'), 'Compares')

    await user.click(within(dialog()).getByRole('button', { name: 'Add quiz' }))
    expect(within(dialog()).getByText('Mark the right answer.')).toBeInTheDocument()

    await user.click(within(dialog()).getByLabelText('Question 1: answer 1 is right'))
    await user.click(within(dialog()).getByRole('button', { name: 'Add quiz' }))
    await status('Quiz added.')
    expect(screen.getByRole('region', { name: 'Quizzes' })).toHaveTextContent('Go check1 question')
    unmount()

    renderAs(STUDENT, '/courses/m6')
    const quizzes = await screen.findByRole('region', { name: 'Quizzes' })
    expect(quizzes).toHaveTextContent('Go check')
    expect(quizzes).toHaveTextContent('1 question')
    expect(quizzes).not.toHaveTextContent('Declares and assigns')
  })

  it('adds and removes questions and answers', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'New quiz' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Add answer' }))
    expect(within(dialog()).getByLabelText('Question 1: answer 3')).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Question 1: remove answer 3' }))
    expect(within(dialog()).queryByLabelText('Question 1: answer 3')).not.toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: 'Add question' }))
    expect(within(dialog()).getByLabelText('Question 2 text')).toBeInTheDocument()
    await user.click(within(dialog()).getByRole('button', { name: 'Remove question 2' }))
    expect(within(dialog()).queryByLabelText('Question 2 text')).not.toBeInTheDocument()
    expect(within(dialog()).queryByRole('button', { name: 'Remove question 1' })).not.toBeInTheDocument() // keep at least one
  })
})

describe('Module editor: module details', () => {
  it('renames a module and moves its dates; students see the change', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Edit details' }))
    const title = within(dialog()).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Go Fundamentals')
    await user.click(within(dialog()).getByRole('button', { name: 'Save module' }))
    await status('Module saved.')
    expect(screen.getByRole('heading', { name: 'Go Fundamentals', level: 1 })).toBeInTheDocument()
    unmount()

    renderAs(STUDENT, '/courses/m6')
    expect(await screen.findByRole('heading', { name: 'Go Fundamentals', level: 1 })).toBeInTheDocument()
  })

  it('refuses a module that closes before it opens', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/courses/m6')
    await user.click(await screen.findByRole('button', { name: 'Edit details' }))
    fireEvent.change(within(dialog()).getByLabelText('Closes on'), { target: { value: '2026-10-01' } })
    await user.click(within(dialog()).getByRole('button', { name: 'Save module' }))
    expect(within(dialog()).getByText('The module must close after it opens.')).toBeInTheDocument()
  })
})

describe('Calendar: lectures and events', () => {
  // the day panel beside the month (the other tests in this file use pop-up dialogs)
  const dialog = () => screen.getByRole('region', { name: 'Day details' })
  const grid = () => screen.getByRole('group', { name: 'Month view' })
  const day = (label: RegExp) => within(grid()).getByRole('button', { name: label })

  it('schedules a lecture linked to a module; students see it with a link to the materials', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAs(LECTURER, '/calendar')
    await screen.findByRole('group', { name: 'Month view' })
    await user.click(day(/^Tuesday, November 10/))
    await user.click(within(dialog()).getByRole('button', { name: 'Add a lecture or event' }))
    const form = within(dialog()).getByRole('form', { name: 'New event' })
    await user.type(within(form).getByLabelText('Title'), 'Go concurrency')
    fireEvent.change(within(form).getByLabelText('Starts'), { target: { value: '14:00' } })
    fireEvent.change(within(form).getByLabelText('Ends'), { target: { value: '16:00' } })
    await user.type(within(form).getByLabelText(/Where/), 'Main hall')
    await user.selectOptions(within(form).getByLabelText(/Module/), 'm6')
    await user.click(within(form).getByRole('button', { name: 'Add event' }))

    expect(await within(dialog()).findByText('Event added. Students can see it now.')).toBeInTheDocument()
    const card = within(within(dialog()).getByRole('list', { name: 'Events' })).getByRole('listitem')
    expect(card).toHaveTextContent('Go concurrency')
    expect(card).toHaveTextContent('14:00 - 16:00 (2 h)')
    unmount()

    renderAs(STUDENT, '/calendar')
    await screen.findByRole('group', { name: 'Month view' })
    await user.click(day(/^Tuesday, November 10/))
    const seen = within(within(dialog()).getByRole('list', { name: 'Events' })).getByRole('listitem')
    expect(seen).toHaveTextContent('Go concurrency')
    expect(within(seen).getByRole('link', { name: 'Open module' })).toHaveAttribute('href', '/courses/m6')
    expect(within(seen).queryByRole('button', { name: /Edit|Delete/ })).not.toBeInTheDocument()
  })

  it('checks the times', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/calendar')
    await screen.findByRole('group', { name: 'Month view' })
    await user.click(day(/^Tuesday, November 10/))
    await user.click(within(dialog()).getByRole('button', { name: 'Add a lecture or event' }))
    await user.type(within(dialog()).getByLabelText('Title'), 'Late')
    fireEvent.change(within(dialog()).getByLabelText('Ends'), { target: { value: '09:00' } })
    await user.click(within(dialog()).getByRole('button', { name: 'Add event' }))
    expect(within(dialog()).getByText('The end time must be after the start time.')).toBeInTheDocument()
  })

  it('edits and deletes an existing event, but not deadlines', async () => {
    const user = userEvent.setup()
    renderAs(LECTURER, '/calendar')
    await screen.findByRole('group', { name: 'Month view' })
    await user.click(day(/^Friday, November 6/)) // team sync + a deadline
    expect(within(dialog()).queryByRole('button', { name: 'Edit Due: CLI tool' })).not.toBeInTheDocument()

    await user.click(within(dialog()).getByRole('button', { name: 'Edit Team sync' }))
    const where = within(dialog()).getByLabelText(/Where/)
    await user.clear(where)
    await user.type(where, 'Room 2')
    await user.click(within(dialog()).getByRole('button', { name: 'Save event' }))
    expect(await within(dialog()).findByText('Event saved.')).toBeInTheDocument()
    expect(within(dialog()).getByRole('list', { name: 'Events' })).toHaveTextContent('Room 2')

    await user.click(within(dialog()).getByRole('button', { name: 'Delete Team sync' }))
    await user.click(within(dialog()).getByRole('button', { name: 'Yes, delete' }))
    expect(await within(dialog()).findByText('Event deleted.')).toBeInTheDocument()
    expect(within(dialog()).getByRole('list', { name: 'Events' })).not.toHaveTextContent('Team sync')
  })
})
