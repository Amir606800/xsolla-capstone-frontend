import { useId, useMemo, useState } from 'react'
import { useMyTeam } from '../../hooks/useMyTeam'
import type { DiscussionDraft } from '../../types/discussion'
import { talkTimeError } from '../../utils/discussions'
import { TimeInput } from '../TimeInput'
import type { Notice } from './DayPanel'

/**
 * Mentor: set up a talk with students of the team, to discuss something. It is not a 1:1, so it can be on any day and it
 * never moves a deadline. Shown in the "add" part of the day panel.
 */
export function TalkForm({
  dayKey,
  now,
  onSave,
  onMessage,
  onDone,
  onCancel,
}: {
  /** The day, as YYYY-MM-DD. */
  dayKey: string
  now: Date
  onSave: (draft: DiscussionDraft) => Promise<void>
  onMessage: (m: Notice | null) => void
  onDone: () => void
  onCancel: () => void
}) {
  const id = useId()
  const { status, team } = useMyTeam()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [start, setStart] = useState('15:00')
  const [end, setEnd] = useState('15:30')
  const [wholeTeam, setWholeTeam] = useState(true)
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const members = team?.members ?? []
  const timeError = useMemo(() => talkTimeError(dayKey, start, end, now), [dayKey, start, end, now])
  const problem = !title.trim()
    ? 'Give the talk a title.'
    : (timeError ?? (!wholeTeam && picked.length === 0 ? 'Choose at least one student.' : null))

  const toggle = (studentId: number) =>
    setPicked((p) => (p.includes(studentId) ? p.filter((x) => x !== studentId) : [...p, studentId]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (problem || busy) return
    setBusy(true)
    onMessage(null)
    try {
      await onSave({
        title,
        note,
        date: dayKey,
        start,
        end,
        studentIds: picked,
        wholeTeam,
      })
      onMessage({
        tone: 'ok',
        text: 'Talk set up. The students can see it on their calendar.',
      })
      onDone()
    } catch (err) {
      onMessage({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Could not set up the talk',
      })
    } finally {
      setBusy(false)
    }
  }

  if (status === 'ready' && members.length === 0) {
    return (
      <div className="slots__form">
        <p className="slots__hint">You have no students in your team yet, so there is nobody to invite.</p>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Close
        </button>
      </div>
    )
  }

  return (
    <form className="slots__form" onSubmit={submit} noValidate>
      <p className="slots__hint">
        A talk to discuss something with your students. It is not a 1:1: nobody books it, and it does not change any deadline.
      </p>

      <label className="field__label" htmlFor={`${id}-title`}>
        Title
      </label>
      <input
        id={`${id}-title`}
        className="field__input"
        value={title}
        maxLength={100}
        placeholder="e.g. Plan for the demo"
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="field__label" htmlFor={`${id}-note`}>
        Note (optional)
      </label>
      <textarea
        id={`${id}-note`}
        className="field__input"
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="slots__fields">
        <div>
          <label className="field__label" htmlFor={`${id}-from`}>
            From
          </label>
          <TimeInput id={`${id}-from`} className="field__input slots__time" value={start} onChange={setStart} />
        </div>
        <div>
          <label className="field__label" htmlFor={`${id}-to`}>
            To
          </label>
          <TimeInput id={`${id}-to`} className="field__input slots__time" value={end} onChange={setEnd} />
        </div>
      </div>

      <fieldset className="slots__who-fieldset">
        <legend className="field__label">Who is invited</legend>
        <label className="slots__check">
          <input type="checkbox" checked={wholeTeam} onChange={(e) => setWholeTeam(e.target.checked)} /> The whole team
        </label>
        {!wholeTeam &&
          members.map((m) => (
            <label key={m.id} className="slots__check">
              <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} /> {m.name}
            </label>
          ))}
      </fieldset>

      {problem && title.trim() !== '' && <p className="field__error">{problem}</p>}

      <div className="slots__fields">
        <button type="submit" className="btn" disabled={problem !== null || busy || status !== 'ready'}>
          Set up the talk
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
