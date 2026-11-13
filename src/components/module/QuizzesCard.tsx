import { memo, useState } from 'react'
import type { QuizItem } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { Icon } from '../Icon'
import { Modal } from '../Modal'

function QuizzesCardBase({
  quizzes = [],
  onSubmitAttempt,
}: {
  quizzes?: QuizItem[]
  onSubmitAttempt?: (quizId: string, answers: number[]) => Promise<void>
}) {
  const readyQuizzes = quizzes.filter((q) => !q.status || q.status === 'ready')
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
  const activeQuiz = readyQuizzes.find((q) => q.id === activeQuizId) ?? null

  return (
    <section className="card" aria-labelledby="quizzes-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="sparkle" size={20} />
        </span>
        <h2 id="quizzes-title">Quizzes</h2>
        {readyQuizzes.length > 0 && <span className="pill">{readyQuizzes.length}</span>}
      </header>
      {readyQuizzes.length === 0 ? (
        <p className="card__empty">No quizzes in this module yet.</p>
      ) : (
        <ul className="list">
          {readyQuizzes.map((q) => {
            const n = q.questions?.length ?? 0
            const hasAttempt = Boolean(q.attempt)
            return (
              <li key={q.id} className="list__row quiz-list__row">
                <div className="quiz-list__info">
                  <p className="list__title">
                    {q.title}
                    {q.isAiGenerated && <span className="pill quiz-badge">AI</span>}
                  </p>
                  <p className="list__meta">
                    {n} {n === 1 ? 'question' : 'questions'}
                    {q.dueAt ? ` · due ${formatDateTime(q.dueAt)}` : ''}
                  </p>
                  {q.description && <p className="list__meta">{q.description}</p>}
                  {q.attempt && (
                    <p className="quiz-list__score">
                      Score: <strong>{q.attempt.score}/{q.attempt.total}</strong>
                    </p>
                  )}
                </div>
                {n > 0 && onSubmitAttempt && (
                  <button
                    type="button"
                    className={`btn btn--small ${hasAttempt ? 'btn--ghost' : ''}`}
                    onClick={() => setActiveQuizId(q.id)}
                  >
                    {hasAttempt ? 'View results' : 'Start quiz'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={activeQuiz !== null} onClose={() => setActiveQuizId(null)} title={activeQuiz?.title ?? 'Quiz'}>
        {activeQuiz && onSubmitAttempt && (
          <QuizRunner
            key={activeQuiz.id}
            quiz={activeQuiz}
            onSubmit={onSubmitAttempt}
            onClose={() => setActiveQuizId(null)}
          />
        )}
      </Modal>
    </section>
  )
}

function QuizRunner({
  quiz,
  onSubmit,
  onClose,
}: {
  quiz: QuizItem
  onSubmit: (quizId: string, answers: number[]) => Promise<void>
  onClose: () => void
}) {
  const questions = quiz.questions ?? []
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const attempt = quiz.attempt

  if (attempt) {
    const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0
    return (
      <div className="quiz-modal">
        <div className="quiz-result">
          <div className="quiz-result__summary">
            <span className={`pill ${pct >= 60 ? 'pill--ok' : 'pill--danger'}`}>
              Result: {attempt.score} / {attempt.total} ({pct}%)
            </span>
            <p className="list__meta">Quiz completed. Review your answers and the correct answers below.</p>
          </div>
        </div>

        <ol className="quiz-questions">
          {questions.map((q, qIdx) => {
            const chosen = attempt.answers[qIdx]
            const correct = q.correct
            const isRight = chosen !== undefined && correct !== undefined && chosen === correct
            return (
              <li key={q.id} className="quiz-question">
                <div className="quiz-question__head">
                  <p className="quiz-question__prompt">
                    {qIdx + 1}. {q.prompt}
                  </p>
                  {correct !== undefined && (
                    <span className={`pill ${isRight ? 'pill--ok' : 'pill--danger'}`}>
                      {isRight ? 'Correct' : 'Incorrect'}
                    </span>
                  )}
                </div>
                <ul className="quiz-options">
                  {q.options.map((opt, optIdx) => {
                    const isChosen = chosen === optIdx
                    const isCorrectOption = correct === optIdx
                    const stateClass = isCorrectOption
                      ? 'quiz-option--correct'
                      : isChosen
                        ? 'quiz-option--wrong'
                        : ''
                    return (
                      <li key={optIdx} className={`quiz-option quiz-option--review ${stateClass}`}>
                        <span className="quiz-option__letter">{String.fromCharCode(65 + optIdx)}.</span>
                        <span className="quiz-option__text">{opt}</span>
                        {isCorrectOption && isChosen && <span className="quiz-option__tag">Your answer · Correct</span>}
                        {isCorrectOption && !isChosen && <span className="quiz-option__tag">Correct answer</span>}
                        {!isCorrectOption && isChosen && <span className="quiz-option__tag quiz-option__tag--wrong">Your answer</span>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ol>

        <div className="form__actions">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const answeredCount = answers.filter((a) => a !== null).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length

  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    if (!allAnswered || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(
        quiz.id,
        answers.map((a) => a ?? 0),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit quiz answers')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="quiz-modal" onSubmit={handleFinish}>
      {quiz.description && <p className="list__meta">{quiz.description}</p>}
      <p className="quiz-modal__progress">
        Answered {answeredCount} of {questions.length}
      </p>

      <ol className="quiz-questions">
        {questions.map((q, qIdx) => (
          <li key={q.id} className="quiz-question">
            <fieldset className="quiz-fieldset">
              <legend className="quiz-question__prompt">
                {qIdx + 1}. {q.prompt}
              </legend>
              <div className="quiz-options">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[qIdx] === optIdx
                  return (
                    <label
                      key={optIdx}
                      className={`quiz-option ${selected ? 'quiz-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`quiz-q-${q.id}`}
                        checked={selected}
                        onChange={() =>
                          setAnswers((prev) => prev.map((val, idx) => (idx === qIdx ? optIdx : val)))
                        }
                      />
                      <span className="quiz-option__letter">{String.fromCharCode(65 + optIdx)}.</span>
                      <span className="quiz-option__text">{opt}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn" disabled={!allAnswered || submitting}>
          {submitting ? 'Submitting...' : 'Finish quiz'}
        </button>
      </div>
    </form>
  )
}

export const QuizzesCard = memo(QuizzesCardBase)
