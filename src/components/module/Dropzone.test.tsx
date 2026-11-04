import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AssignmentItem } from '../../types/course'
import { SubmissionPanel } from './SubmissionPanel'

const assignment: AssignmentItem = {
  id: 'a1',
  moduleId: 'm1',
  type: 'assignment',
  title: 'Task',
  dueAt: new Date(2026, 10, 20).toISOString(),
  maxPoints: 100,
}

const file = (name: string, size = 100) => {
  const f = new File(['x'], name, { type: 'application/octet-stream' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

/** dataTransfer stub: jsdom has no DataTransfer; `types` must contain "Files" for file drags. */
const transfer = (files: File[], types: string[] = ['Files']) => ({
  dataTransfer: { files, types, dropEffect: 'none' },
})

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  render(<SubmissionPanel assignment={assignment} onSubmit={onSubmit} />)
  return { onSubmit, zone: screen.getByRole('group', { name: 'File drop area' }) }
}

const queued = () => screen.queryByRole('list', { name: 'Files to upload' })

describe('file drag & drop', () => {
  it('shows a drop area that still works as a normal file picker', () => {
    const { zone } = setup()
    expect(zone).toHaveTextContent('Drag & drop files here, or click to browse')
    expect(within(zone).getByLabelText(/^Files/)).toHaveAttribute('type', 'file')
  })

  it('highlights while files are dragged over and clears when they leave', () => {
    const { zone } = setup()
    fireEvent.dragEnter(zone, transfer([file('a.pdf')]))
    expect(zone).toHaveClass('is-dragging')
    expect(zone).toHaveTextContent('Drop to add the files')

    fireEvent.dragLeave(zone, transfer([file('a.pdf')]))
    expect(zone).not.toHaveClass('is-dragging')
    expect(zone).toHaveTextContent('Drag & drop files here')
  })

  it('does not flicker when the drag moves across child elements', () => {
    const { zone } = setup()
    const child = zone.querySelector('.dropzone__text')!
    fireEvent.dragEnter(zone, transfer([file('a.pdf')]))
    fireEvent.dragEnter(child, transfer([file('a.pdf')])) // entering a child...
    fireEvent.dragLeave(zone, transfer([file('a.pdf')])) // ...fires leave on the parent
    expect(zone).toHaveClass('is-dragging')
    fireEvent.dragLeave(child, transfer([file('a.pdf')]))
    expect(zone).not.toHaveClass('is-dragging')
  })

  it('ignores drags that are not files (e.g. selected text)', () => {
    const { zone } = setup()
    fireEvent.dragEnter(zone, transfer([], ['text/plain']))
    expect(zone).not.toHaveClass('is-dragging')
    fireEvent.drop(zone, transfer([], ['text/plain']))
    expect(queued()).not.toBeInTheDocument()
  })

  it('allows the drop (preventDefault on dragover) so the browser does not open the file', () => {
    const { zone } = setup()
    const notCancelled = fireEvent.dragOver(zone, transfer([file('a.pdf')]))
    expect(notCancelled).toBe(false) // false = default was prevented
    const dropNotCancelled = fireEvent.drop(zone, transfer([file('a.pdf')]))
    expect(dropNotCancelled).toBe(false)
  })

  it('adds dropped files to the list, clears the highlight, and submits them', async () => {
    const { zone, onSubmit } = setup()
    fireEvent.dragEnter(zone, transfer([file('a.pdf'), file('b.zip')]))
    fireEvent.drop(zone, transfer([file('a.pdf'), file('b.zip')]))

    expect(zone).not.toHaveClass('is-dragging')
    expect(within(queued()!).getAllByRole('listitem')).toHaveLength(2)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Submit' }))
    const sent = onSubmit.mock.calls[0][1].files as File[]
    expect(sent.map((f) => f.name)).toEqual(['a.pdf', 'b.zip'])
  })

  it('applies the same checks as the picker: bad types and oversize files are rejected', () => {
    const { zone } = setup()
    fireEvent.drop(zone, transfer([file('ok.md'), file('virus.exe'), file('huge.zip', 60 * 1024 * 1024)]))

    expect(within(queued()!).getAllByRole('listitem')).toHaveLength(1)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('virus.exe: only pdf, pptx, md, zip files are allowed')
    expect(alert).toHaveTextContent('huge.zip: file is larger than 50 MB')
  })

  it('accumulates drops and ignores duplicates', () => {
    const { zone } = setup()
    fireEvent.drop(zone, transfer([file('a.pdf')]))
    fireEvent.drop(zone, transfer([file('a.pdf'), file('b.pdf')]))
    expect(within(queued()!).getAllByRole('listitem')).toHaveLength(2)
  })

  it('mixes dropped and picked files, and a dropped file can be removed again', async () => {
    const user = userEvent.setup()
    const { zone } = setup()
    fireEvent.drop(zone, transfer([file('dropped.pdf')]))
    await user.upload(screen.getByLabelText(/^Files \(/), file('picked.pdf'))
    expect(within(queued()!).getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Remove dropped.pdf' }))
    expect(within(queued()!).getAllByRole('listitem')).toHaveLength(1)
    expect(queued()).toHaveTextContent('picked.pdf')
  })

  it('a dropped file enables the submit button even without text', () => {
    const { zone } = setup()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
    fireEvent.drop(zone, transfer([file('a.pdf')]))
    expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
  })
})
