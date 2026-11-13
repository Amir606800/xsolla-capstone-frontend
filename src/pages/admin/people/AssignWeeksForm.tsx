import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CourseModule } from '../../../types/course'
import { lecturersOf } from '../../../utils/content'

export interface WeekChanges {
  /** Weeks to give to the lecturer (the week's other lecturers stay). */
  assign: string[]
  /** Weeks to take off the lecturer; the week's other lecturers stay. */
  unassign: string[]
}

/**
 * Admin: the weeks (modules) a lecturer teaches. Their own weeks start ticked: untick one to take the
 * lecturer off it, tick another week to add them to it. A week can have several lecturers.
 */
export function AssignWeeksForm({
  lecturerId,
  modules,
  nameOf,
  onSave,
  onCancel,
}: {
  lecturerId: number
  modules: CourseModule[]
  nameOf: (id: number | undefined) => string
  onSave: (changes: WeekChanges) => Promise<void>
  onCancel: () => void
}) {
  const sorted = [...modules].sort((a, b) => a.position - b.position)
  const own = sorted.filter((m) => lecturersOf(m).includes(lecturerId)).map((m) => m.id)
  const [ticked, setTicked] = useState<string[]>(own)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const assign = ticked.filter((id) => !own.includes(id))
  const unassign = own.filter((id) => !ticked.includes(id))
  const changed = assign.length + unassign.length > 0
  const summary = [
    assign.length ? `give ${assign.length} ${assign.length === 1 ? 'week' : 'weeks'}` : '',
    unassign.length ? `take off ${unassign.length} ${unassign.length === 1 ? 'week' : 'weeks'}` : '',
  ]
    .filter(Boolean)
    .join(', ')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!changed || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave({ assign, unassign })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The weeks could not be saved.')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} aria-label="Weeks">
      <fieldset className="admin-roles admin-weeks">
        <legend className="admin-field__label">Weeks</legend>
        {sorted.map((m) => {
          const others = lecturersOf(m).filter((id) => id !== lecturerId)
          return (
            <label key={m.id} className="admin-check">
              <input
                type="checkbox"
                checked={ticked.includes(m.id)}
                onChange={(e) => setTicked((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))}
              />
              <span>
                Week {m.position} · {m.title}
                <span className="admin-hint">{others.length ? `Also: ${others.map((id) => nameOf(id)).join(', ')}` : lecturersOf(m).length ? 'Only them' : 'No lecturer'}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      <p className="admin-muted" aria-live="polite">
        {changed ? `Will ${summary}.` : 'Tick a week to give it to them, untick one to take it off.'}
      </p>
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || !changed}>
          {busy ? 'Saving…' : 'Save weeks'}
        </button>
      </div>
    </form>
  )
}
