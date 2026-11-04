import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CoursesPage from './CoursesPage'
import { CoursesProvider } from '../context/CoursesProvider'
import { renderWithProviders } from '../test/renderWithProviders'

function renderCourses() {
  return renderWithProviders(
    <CoursesProvider>
      <CoursesPage />
    </CoursesProvider>,
  )
}

const layoutGroup = () => screen.getByRole('group', { name: 'Layout' })

describe('My courses - grid / list switch', () => {
  it('defaults to the grid layout', async () => {
    renderCourses()
    const list = await screen.findByRole('list', { name: 'Modules' })
    expect(list).toHaveClass('module-cards--grid')
    expect(within(layoutGroup()).getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(layoutGroup()).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches to list and back without losing any module', async () => {
    const user = userEvent.setup()
    renderCourses()
    const list = await screen.findByRole('list', { name: 'Modules' })

    await user.click(within(layoutGroup()).getByRole('button', { name: 'List' }))
    expect(list).toHaveClass('module-cards--list')
    expect(list).not.toHaveClass('module-cards--grid')
    expect(within(list).getAllByRole('link')).toHaveLength(12)
    expect(within(layoutGroup()).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(layoutGroup()).getByRole('button', { name: 'Grid' }))
    expect(list).toHaveClass('module-cards--grid')
    expect(within(list).getAllByRole('link')).toHaveLength(12)
  })

  it('shows the same details in both layouts', async () => {
    const user = userEvent.setup()
    renderCourses()
    const list = await screen.findByRole('list', { name: 'Modules' })
    const first = () => within(list).getAllByRole('link')[0]

    expect(first()).toHaveTextContent('Module 1')
    expect(first()).toHaveTextContent('Onboarding & Git')
    expect(first()).toHaveTextContent('All submitted')

    await user.click(within(layoutGroup()).getByRole('button', { name: 'List' }))
    expect(first()).toHaveTextContent('Module 1')
    expect(first()).toHaveTextContent('Onboarding & Git')
    expect(first()).toHaveTextContent('All submitted')
    expect(first()).toHaveAttribute('href', '/courses/m1')
  })

  it('remembers the layout across visits', async () => {
    const user = userEvent.setup()
    const first = renderCourses()
    await screen.findByRole('list', { name: 'Modules' })
    await user.click(within(layoutGroup()).getByRole('button', { name: 'List' }))
    expect(localStorage.getItem('courses_view')).toBe('list')
    first.unmount()

    renderCourses()
    expect(await screen.findByRole('list', { name: 'Modules' })).toHaveClass('module-cards--list')
  })

  it('falls back to grid when the stored value is invalid', async () => {
    localStorage.setItem('courses_view', 'carousel')
    renderCourses()
    expect(await screen.findByRole('list', { name: 'Modules' })).toHaveClass('module-cards--grid')
  })

  it('offers the switch even while loading', () => {
    renderCourses()
    expect(layoutGroup()).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
  })
})
