import { Modal } from '../../../components/Modal'
import type { SchoolUser } from '../../../types/admin'
import type { CourseModule } from '../../../types/course'
import { AssignWeeksForm } from './AssignWeeksForm'

/**
 * Admin: the dialog for giving a lecturer weeks, from the Lecturers page (the calendar icon) and from the Mentors page
 * right after a mentor was made a lecturer. `onDone` gets the sentence to show on the page.
 */
export function AssignWeeksModal({
  person,
  modules,
  nameOf,
  assignLecturer,
  onClose,
  onDone,
}: {
  /** Whose weeks; the dialog is closed when there is nobody. */
  person: SchoolUser | undefined
  modules: CourseModule[]
  nameOf: (id: number | undefined) => string
  assignLecturer: (moduleId: string, lecturerId: number, assigned?: boolean) => Promise<unknown>
  onClose: () => void
  onDone: (text: string) => void
}) {
  const weekNumbers = (ids: string[]) =>
    modules
      .filter((m) => ids.includes(m.id))
      .map((m) => m.position)
      .sort((a, b) => a - b)
      .join(', ')

  return (
    <Modal open={!!person} onClose={onClose} title={person ? `Weeks of ${person.name}` : ''} initialFocus=".admin-dialog input:not(:disabled)">
      {person && (
        <AssignWeeksForm
          lecturerId={person.id}
          modules={modules}
          nameOf={nameOf}
          onCancel={onClose}
          onSave={async ({ assign, unassign }) => {
            for (const id of unassign) await assignLecturer(id, person.id, false)
            for (const id of assign) await assignLecturer(id, person.id)
            const parts = [
              assign.length ? `now teaches ${assign.length === 1 ? 'week' : 'weeks'} ${weekNumbers(assign)}` : '',
              unassign.length ? `${assign.length ? 'and ' : ''}is off ${unassign.length === 1 ? 'week' : 'weeks'} ${weekNumbers(unassign)}` : '',
            ]
            onDone(`${person.name} ${parts.filter(Boolean).join(' ')}.`)
          }}
        />
      )}
    </Modal>
  )
}
