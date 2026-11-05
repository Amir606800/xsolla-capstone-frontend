import { useRef, useState } from 'react'
import type { QuizItem } from '../../types/course'
import { MAX_OPTIONS, MIN_OPTIONS, emptyQuestion, quizHasErrors, quizToDraft, validateQuiz } from '../../utils/authoring'
import type { QuestionDraft, QuizDraft } from '../../utils/authoring'
import { Icon } from '../Icon'
import { Field, FormActions } from './Field'
import { useSave } from './useSave'

let qSeq = 0
const newQuestionId = () => `q-${Date.now().toString(36)}${(qSeq++).toString(36)}`

function QuestionEditor({
  q,
  index,
  error,
  canRemove,
  onChange,
  onRemove,
}: {
  q: QuestionDraft
  index: number
  error?: string
  canRemove: boolean
  onChange: (q: QuestionDraft) => void
  onRemove: () => void
}) {
  const n = index + 1
  const setOption = (i: number, value: string) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? value : o)) })
  const removeOption = (i: number) => {
    const options = q.options.filter((_, j) => j !== i)
    // keep the right answer pointing at the same option
    const correct = q.correct === null || q.correct === i ? null : q.correct > i ? q.correct - 1 : q.correct
    onChange({ ...q, options, correct })
  }

  return (
    <li className="quiz-q">
      <fieldset className="form__group">
        <legend className="quiz-q__legend">Question {n}</legend>
        <Field label={`Question ${n} text`}>
          {(p) => <input {...p} className="field__input form__input" value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} />}
        </Field>

        <p className="form__hint">Answers: select the right one.</p>
        <ul className="quiz-q__options">
          {q.options.map((o, i) => (
            <li key={i} className="quiz-q__option">
              <input
                type="radio"
                name={`correct-${q.id}`}
                checked={q.correct === i}
                onChange={() => onChange({ ...q, correct: i })}
                aria-label={`Question ${n}: answer ${i + 1} is right`}
              />
              <input
                className="field__input form__input"
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                aria-label={`Question ${n}: answer ${i + 1}`}
              />
              {q.options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeOption(i)}
                  aria-label={`Question ${n}: remove answer ${i + 1}`}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="quiz-q__tools">
          {q.options.length < MAX_OPTIONS && (
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange({ ...q, options: [...q.options, ''] })}>
              <Icon name="plus" size={16} /> Add answer
            </button>
          )}
          {canRemove && (
            <button type="button" className="btn btn--ghost btn--small" onClick={onRemove} aria-label={`Remove question ${n}`}>
              <Icon name="trash" size={16} /> Remove question
            </button>
          )}
        </div>
        {error && <p className="field__error">{error}</p>}
      </fieldset>
    </li>
  )
}

export function QuizForm({
  item,
  onSave,
  onCancel,
}: {
  item?: QuizItem
  onSave: (draft: QuizDraft) => Promise<void>
  onCancel: () => void
}) {
  const [d, setD] = useState<QuizDraft>(() => quizToDraft(item, newQuestionId))
  const { touched, busy, error, submit } = useSave()
  const errors = validateQuiz(d)
  const set = (patch: Partial<QuizDraft>) => setD((prev) => ({ ...prev, ...patch }))
  const listRef = useRef<HTMLOListElement>(null)

  const updateQuestion = (id: string, q: QuestionDraft) => set({ questions: d.questions.map((x) => (x.id === id ? q : x)) })
  const addQuestion = () => {
    set({ questions: [...d.questions, emptyQuestion(newQuestionId())] })
    // move to the new question so a keyboard user can type right away
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('.quiz-q > fieldset > .form__field input')
      inputs?.[inputs.length - 1]?.focus()
    })
  }

  return (
    <form
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit(quizHasErrors(errors), () => onSave(d))
      }}
    >
      <p className="form__note">
        <Icon name="sparkle" size={16} /> Students will see the quiz in the module. Taking it comes in a later version,
        and they never see the right answers.
      </p>
      <Field label="Title" error={touched ? errors.title : undefined}>
        {(p) => <input {...p} className="field__input form__input" value={d.title} onChange={(e) => set({ title: e.target.value })} />}
      </Field>
      <Field label="Description" optional>
        {(p) => <input {...p} className="field__input form__input" value={d.description} onChange={(e) => set({ description: e.target.value })} />}
      </Field>
      <div className="form__row">
        <Field label="Due date" optional error={touched ? errors.due : undefined}>
          {(p) => <input {...p} type="date" className="field__input form__input" value={d.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />}
        </Field>
        <Field label="Due time" optional>
          {(p) => <input {...p} type="time" className="field__input form__input" value={d.dueTime} onChange={(e) => set({ dueTime: e.target.value })} />}
        </Field>
      </div>

      <ol className="quiz-qs" aria-label="Questions" ref={listRef}>
        {d.questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            q={q}
            index={i}
            error={touched ? errors.byQuestion[q.id] : undefined}
            canRemove={d.questions.length > 1}
            onChange={(next) => updateQuestion(q.id, next)}
            onRemove={() => set({ questions: d.questions.filter((x) => x.id !== q.id) })}
          />
        ))}
      </ol>
      {touched && errors.questions && <p className="field__error">{errors.questions}</p>}
      <button type="button" className="btn btn--ghost" onClick={addQuestion}>
        <Icon name="plus" size={18} /> Add question
      </button>

      <FormActions submitLabel={item ? 'Save quiz' : 'Add quiz'} busy={busy} error={error} onCancel={onCancel} />
    </form>
  )
}
