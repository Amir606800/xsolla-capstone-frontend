import { useId, useMemo, useState } from 'react'
import { createModuleQuiet, writeItemQuiet } from '../../../api/courses'
import { useAuth } from '../../../hooks/useAuth'
import { useCourses } from '../../../hooks/useCourses'
import { newId } from '../../../mocks/contentEdits'
import { runImport } from '../../../utils/moduleImport'
import type { ImportResult } from '../../../utils/moduleImport'
import { countTemplate, MAX_TEMPLATE_BYTES, parseTemplate, planImport } from '../../../utils/moduleTemplate'
import type { ModuleTemplate } from '../../../utils/moduleTemplate'
import { formatShortDate } from '../../../utils/date'
import { Icon } from '../../../components/Icon'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const pad = (n: number) => String(n).padStart(2, '0')
const dayInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The next Monday (today when it is one): the usual first day of week 1. */
function nextMonday(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7))
  return dayInput(d)
}

/**
 * Admin: build the modules from a template file. Pick the file, say which day week 1 starts, look at what will be
 * made, confirm. Every date in the template moves with that day; nothing already in the course is touched.
 */
export function ImportTemplate({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const { modules, reload } = useCourses()
  const { user } = useAuth()
  const id = useId()
  const [fileName, setFileName] = useState('')
  const [template, setTemplate] = useState<ModuleTemplate | null>(null)
  const [problem, setProblem] = useState('')
  const [start, setStart] = useState(nextMonday)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  const plan = useMemo(() => (template && start ? planImport(template, start) : []), [template, start])
  const counts = template ? countTemplate(template) : null
  const first = plan[0]
  const last = plan.at(-1)

  // the new weeks open between the existing ones when the dates overlap, and the numbers follow the opening dates
  const overlaps = useMemo(() => {
    if (!first || !last) return false
    return modules.some((m) => m.opensAt && m.closesAt && m.opensAt <= last.closesAt && m.closesAt >= first.opensAt)
  }, [modules, first, last])

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setTemplate(null)
    setProblem('')
    setResult(null)
    setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > MAX_TEMPLATE_BYTES) {
      setProblem('This file is too big for a module template.')
      return
    }
    const parsed = parseTemplate(await file.text())
    if (parsed.ok) setTemplate(parsed.template)
    else setProblem(parsed.error)
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!template || plan.length === 0 || busy) return
    setBusy(true)
    const res = await runImport(
      plan,
      {
        createModule: (patch) => createModuleQuiet(patch, { createdBy: user?.id }),
        writeItem: writeItemQuiet,
      },
      newId,
      (done, total) => setProgress(done < total ? `Making module ${done + 1} of ${total}…` : ''),
    )
    reload() // one reload for everything that was made
    setProgress('')
    setBusy(false)
    setResult(res)
  }

  if (result) {
    const made = `${plural(result.modules, 'module')} with ${plural(result.tasks, 'task')}, ${plural(result.links, 'link')} and ${plural(result.quizzes, 'quiz', 'quizzes')}`
    return (
      <div className="import-template">
        <p role="status">
          {result.stoppedAt ? <strong>The import stopped. </strong> : <strong>Done. </strong>}
          Made {made}.
        </p>
        {result.stoppedAt && (
          <p className="field__error" role="alert">
            Module &ldquo;{result.stoppedAt.title}&rdquo; could not be made: {result.stoppedAt.reason} The modules before it stay; the rest were not made.
          </p>
        )}
        {result.skipped.length > 0 && (
          <>
            <p>{plural(result.skipped.length, 'item')} could not be saved and {result.skipped.length === 1 ? 'was' : 'were'} left out:</p>
            <ul className="admin-hint">
              {result.skipped.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}
        <div className="import-template__actions">
          <button type="button" className="admin-btn admin-btn--primary" onClick={() => onDone(`Imported ${made}.${result.skipped.length ? ` ${plural(result.skipped.length, 'item')} left out.` : ''}`)}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="import-template" onSubmit={run} noValidate>
      <p className="import-template__lead">
        Builds the modules, their tasks, links and quizzes from a template file made with &ldquo;Export template&rdquo;. Nothing in the course now is changed.
      </p>

      <div className="import-template__field">
        <span className="field__label" id={`${id}-file-label`}>
          Template file
        </span>
        <div className="import-pick">
          <input id={`${id}-file`} className="sr-only" type="file" accept=".json,application/json" aria-labelledby={`${id}-file-label`} onChange={pick} disabled={busy} />
          <label className={`import-pick__box${template ? ' is-chosen' : ''}`} htmlFor={`${id}-file`}>
            <Icon name={template ? 'check' : 'upload'} size={22} />
            <span className="import-pick__text">
              <strong>{fileName || 'Choose a template file'}</strong>
              <span>{fileName ? 'Click to choose another one' : 'A .json file made with "Export template"'}</span>
            </span>
          </label>
        </div>
        {problem && (
          <p className="field__error" role="alert">
            {problem}
          </p>
        )}
      </div>

      {template && counts && (
        <>
          <p className="import-template__note">
            <Icon name="check" size={16} />
            <span>
              <strong>{fileName}</strong>: {plural(counts.modules, 'module')}, {plural(counts.tasks, 'task')}, {plural(counts.links, 'link')},{' '}
              {plural(counts.quizzes, 'quiz', 'quizzes')}.
              {template.left_out && template.left_out.files > 0 && ` ${plural(template.left_out.files, 'uploaded file')} were not in the file: add them to the modules afterwards.`}
            </span>
          </p>

          <div className="import-template__field">
            <label className="field__label" htmlFor={`${id}-start`}>
              Week 1 opens on
            </label>
            <input id={`${id}-start`} className="field__input import-template__date" type="date" value={start} onChange={(e) => setStart(e.target.value)} disabled={busy} />
            <p className="import-template__hint">All the dates of the template move with this day.</p>
          </div>

          {first && last && (
            <p className="import-template__hint" role="status">
              The modules will run from {formatShortDate(first.opensAt)} to {formatShortDate(last.closesAt)}.
            </p>
          )}
          {overlaps && (
            <p className="import-template__warn" role="status">
              <Icon name="alert" size={16} />
              <span>These dates overlap modules that already exist. Modules are numbered by the day they open, so the new ones will mix in with them.</span>
            </p>
          )}
        </>
      )}

      {progress && (
        <p className="admin-muted" role="status">
          {progress}
        </p>
      )}
      <div className="import-template__actions">
        <button type="button" className="admin-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="admin-btn admin-btn--primary" disabled={!template || !start || busy}>
          {busy ? 'Making the modules…' : template ? `Make ${plural(template.modules.length, 'module')}` : 'Make the modules'}
        </button>
      </div>
    </form>
  )
}
