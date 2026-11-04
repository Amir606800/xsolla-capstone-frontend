import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { submitWork } from '../api/courses'
import App from '../App'
import { renderWithProviders } from '../test/renderWithProviders'

function renderAt(route: string) {
  localStorage.setItem(
    'auth_user',
    JSON.stringify({ id: 1, name: 'Sam', email: 'sam@example.com', role: 'student' }),
  )
  return renderWithProviders(<App />, { route })
}

const pdf = (name = 'solution.pdf', size = 1024) => {
  const f = new File(['x'], name, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

async function openAssignment(user: ReturnType<typeof userEvent.setup>, title: RegExp) {
  await user.click(await screen.findByRole('button', { name: title }))
}

describe('ModulePage - content', () => {
  it('shows the module header with description, opened/due times and a back link', async () => {
    renderAt('/courses/m6')
    expect(await screen.findByRole('heading', { name: 'Go Basics' })).toBeInTheDocument()
    expect(screen.getByText('Module 6')).toBeInTheDocument()
    expect(screen.getByText(/Fundamentals of Go/)).toBeInTheDocument()
    expect(screen.getByText('Opened')).toBeInTheDocument()
    expect(screen.getByText('Due')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Tasks submitted' })).toBeInTheDocument()
    // (the sidebar has a "My courses" link too, so scope to the page content)
    const back = within(screen.getByRole('main')).getByRole('link', { name: /My courses/ })
    expect(back).toHaveAttribute('href', '/courses')
  })

  it('lists assignments, resources and the reserved quizzes slot', async () => {
    renderAt('/courses/m6')
    const assignments = await screen.findByRole('region', { name: 'Assignments' })
    expect(within(assignments).getAllByRole('button')).toHaveLength(2)
    expect(within(assignments).getByRole('button', { name: /CLI tool/ })).toBeInTheDocument()

    const resources = screen.getByRole('region', { name: 'Resources' })
    expect(within(resources).getAllByRole('listitem')).toHaveLength(2)

    const quizzes = screen.getByRole('region', { name: 'Quizzes' })
    expect(within(quizzes).getByText('Coming soon')).toBeInTheDocument()
  })

  it('opens external links safely in a new tab; file downloads are placeholders for now', async () => {
    renderAt('/courses/m6')
    const link = await screen.findByRole('link', { name: 'Open Go Basics - further reading' })
    expect(link).toHaveAttribute('href', 'https://developer.mozilla.org/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('button', { name: 'Download Go Basics - lecture slides' })).toBeDisabled()
  })

  it('shows a not-found state for an unknown module', async () => {
    renderAt('/courses/nope')
    expect(await screen.findByRole('heading', { name: 'Module not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to my courses' })).toHaveAttribute('href', '/courses')
  })

  it('expands an assignment to show description and requirements, and collapses again', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    expect(screen.getByText(/Complete the "HTTP server" task/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument()
    expect(screen.getByText('Include a short README explaining your approach')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /HTTP server/ })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /HTTP server/ }))
    expect(screen.queryByRole('heading', { name: 'Requirements' })).not.toBeInTheDocument()
  })
})

describe('ModulePage - submitting work', () => {
  it('submit is disabled until there is text or a file', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    const submit = screen.getByRole('button', { name: 'Submit' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText(/Answer or link/), '   ')
    expect(submit).toBeDisabled() // whitespace only
    await user.type(screen.getByLabelText(/Answer or link/), 'https://github.com/me/http-server')
    expect(submit).toBeEnabled()
  })

  it('submits text: status becomes Submitted, confirmation shown, form switches to resubmit', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    await user.type(screen.getByLabelText(/Answer or link/), 'https://github.com/me/http-server')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText('Your work was submitted.')).toBeInTheDocument()
    expect(submitWork).toHaveBeenLastCalledWith('m6-a2', {
      textBody: 'https://github.com/me/http-server',
      files: [],
    })
    expect(screen.getByRole('button', { name: /HTTP server/ })).toHaveTextContent('Submitted')
    expect(screen.getByText('https://github.com/me/http-server', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resubmit' })).toBeInTheDocument()
    // header progress moved from 1/2 to 2/2
    expect(screen.getByRole('progressbar', { name: 'Tasks submitted' })).toHaveAttribute('aria-valuenow', '2')
  })

  it('accepts files, lists them, lets you remove one, and submits them', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    const input = screen.getByLabelText(/^Files/)
    await user.upload(input, [pdf('a.pdf'), pdf('b.pdf')])
    const toUpload = screen.getByRole('list', { name: 'Files to upload' })
    expect(within(toUpload).getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Remove b.pdf' }))
    expect(within(toUpload).getAllByRole('listitem')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    expect(await screen.findByRole('list', { name: 'Submitted files' })).toHaveTextContent('a.pdf')
    expect(screen.queryByRole('list', { name: 'Files to upload' })).not.toBeInTheDocument()
  })

  it('rejects disallowed file types and oversize files with a message', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    const input = screen.getByLabelText(/^Files/)
    await user.upload(input, [pdf('virus.exe'), pdf('huge.zip', 60 * 1024 * 1024)])

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('virus.exe: only pdf, pptx, md, zip files are allowed')
    expect(alert).toHaveTextContent('huge.zip: file is larger than 50 MB')
    expect(screen.queryByRole('list', { name: 'Files to upload' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
  })

  it('ignores the same file picked twice', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)
    const input = screen.getByLabelText(/^Files/)
    await user.upload(input, pdf('dup.pdf'))
    await user.upload(input, pdf('dup.pdf'))
    expect(within(screen.getByRole('list', { name: 'Files to upload' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('shows an error and keeps the form usable when the upload fails', async () => {
    vi.mocked(submitWork).mockRejectedValueOnce(new Error('network'))
    const user = userEvent.setup()
    renderAt('/courses/m6')
    await openAssignment(user, /HTTP server/)

    await user.type(screen.getByLabelText(/Answer or link/), 'my work')
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(await screen.findByText(/Something went wrong while submitting/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
    expect(screen.getByRole('button', { name: /HTTP server/ })).not.toHaveTextContent('Submitted')
  })

  it('shows grade and feedback, and resubmitting keeps the grade', async () => {
    const user = userEvent.setup()
    renderAt('/courses/m4')
    await openAssignment(user, /Typed utils/)

    expect(screen.getByText(/Grade: \d+\/100/)).toBeInTheDocument()
    expect(screen.getByText(/Resubmitting replaces your previous submission/)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Answer or link/), ' - updated')
    await user.click(screen.getByRole('button', { name: 'Resubmit' }))
    expect(await screen.findByText('Your work was submitted.')).toBeInTheDocument()
    expect(screen.getByText(/Grade: \d+\/100/)).toBeInTheDocument()
  })

  it('flags an unsubmitted past-deadline assignment as Overdue', async () => {
    renderAt('/courses/m4')
    expect(await screen.findByRole('button', { name: /Migrate a module/ })).toHaveTextContent('Overdue')
  })
})

describe('ModulePage - shared state', () => {
  it('a submission made here is reflected on the dashboard', async () => {
    const user = userEvent.setup()
    renderAt('/dashboard')

    const tasks = await screen.findByRole('progressbar', { name: 'Tasks' })
    const before = Number(tasks.getAttribute('aria-valuenow'))

    await user.click(screen.getByRole('link', { name: /^Module 6:/ }))
    await openAssignment(user, /HTTP server/)
    await user.type(screen.getByLabelText(/Answer or link/), 'done')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await screen.findByText('Your work was submitted.')

    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByRole('progressbar', { name: 'Tasks' })).toHaveAttribute(
      'aria-valuenow',
      String(before + 1),
    )
  })
})
