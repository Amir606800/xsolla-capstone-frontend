import { useState } from 'react'
import type { FormEvent } from 'react'
import type { CourseModule } from '../../../types/course'

/**
 * Admin: the weeks (modules) a lecturer teaches. Their own weeks are ticked; tick another week to give
 * it to them (it leaves its current lecturer). A week always has a lecturer, so to take a week away,
 * give it to someone else.
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
  onSave: (moduleIds: string[]) => Promise<void>
  onCancel: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sorted = [...modules].sort((a, b) => a.position - b.position)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (picked.length === 0 || busy) return
    setBusy(true)
    setError('')
    try {
      await onSave(picked)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The weeks could not be assigned.')
      setBusy(false)
    }
  }

  return (
    <form className="admin-dialog" onSubmit={submit} aria-label="Assign weeks">
      <fieldset className="admin-roles admin-weeks">
        <legend className="admin-field__label">Weeks</legend>
        {sorted.map((m) => {
          const own = m.createdBy === lecturerId
          return (
            <label key={m.id} className="admin-check">
              <input
                type="checkbox"
                checked={own || picked.includes(m.id)}
                disabled={own}
                onChange={(e) => setPicked((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)))}
              />
              <span>
                Week {m.position} · {m.title}
                <span className="admin-hint">{own ? 'Already theirs' : `Now: ${nameOf(m.createdBy)}`}</span>
              </span>
            </label>
          )
        })}
      </fieldset>
      {error && (
        <p className="admin-field__error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-confirm__actions">
        <button type="button" className="admin-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy || picked.length === 0}>
          {busy ? 'Saving…' : picked.length ? `Assign ${picked.length} ${picked.length === 1 ? 'week' : 'weeks'}` : 'Assign weeks'}
        </button>
      </div>
    </form>
  )
}
