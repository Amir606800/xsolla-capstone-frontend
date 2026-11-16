import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeekGradeItem } from './WeekGradeItem'

const student = { id: 101, name: 'Leyla Hasanova', email: 'leyla@example.com' }
const show = (lateTasks: string[]) =>
  render(
    <ul>
      <WeekGradeItem
        student={student}
        week={5}
        grade={undefined}
        theirWeeks={[]}
        open
        alwaysOpen
        lateTasks={lateTasks}
        onToggle={vi.fn()}
        onSave={vi.fn()}
      />
    </ul>,
  )

describe('the week grade after a late hand-in', () => {
  it('is red, says why, and green or yellow cannot be picked', () => {
    show(['HTTP server'])
    expect(screen.getByRole('note')).toHaveTextContent('Red because of a late submission (HTTP server)')
    expect(screen.getByRole('radio', { name: /No progress/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /On track/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Falling behind/ })).toBeDisabled()
  })

  it('without a late hand-in every grade can be picked', () => {
    show([])
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('radio', { name: /On track/ })).toBeEnabled()
  })
})
