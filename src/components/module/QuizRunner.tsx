import { useState } from 'react'
import type { FormEvent } from 'react'
import type { QuizItem } from '../../types/course'
import { Icon } from '../Icon'
import './quiz-runner.css'

const letter = (i: number) => String.fromCharCode(65 + i)

/** Scrolls to a question inside the pop-up (the sticky bars are accounted for by `scroll-margin-top`). */
function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

function verdict(pct: number): string {
  if (pct >= 80) return 'Great work!'
  if (pct >= 60) return 'Good job. A little more revision and it is perfect.'
  return 'Worth another look at the lesson material.'
}

/**
 * One quiz in a pop-up. Not taken yet: every question on one page, a bar on top that shows how many are answered (and jumps
 * to a question), and Finish at the bottom once all are answered. Taken: the score, a filter for the questions you missed,
 * and every question with your answer and the right one.
 */
export function QuizRunner({
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
  const [show, setShow] = useState<'all' | 'wrong' | 'right'>('all')
  const prefix = `quiz-${quiz.id.replace(/\W/g, '')}-q`

  const attempt = quiz.attempt

  if (attempt) {
    const total = attempt.total
    const pct = total > 0 ? Math.round((attempt.score / total) * 100) : 0
    const right = questions.map((q, i) => q.correct !== undefined && attempt.answers[i] === q.correct)
    const rightCount = right.filter(Boolean).length
    const wrongCount = questions.length - rightCount
    const listed = questions.map((q, i) => ({ q, i })).filter(({ i }) => show === 'all' || (show === 'right' ? right[i] : !right[i]))
    const tone = pct >= 60 ? 'ok' : 'danger'

    return (
      <div className="quiz-modal">
        <div className="quiz-top">
          <div className="quiz-top__result">
            <div className={`quiz-ring quiz-ring--${tone}`} style={{ ['--pct' as string]: pct }} role="img" aria-label={`${pct} percent`}>
              <span>
                {attempt.score}/{total}
              </span>
            </div>
            <div className="quiz-top__text">
              <span className={`pill ${tone === 'ok' ? 'pill--ok' : 'pill--danger'}`}>
                Result: {attempt.score} / {total} ({pct}%)
              </span>
              <p className="quiz-top__msg">{verdict(pct)}</p>
              <p className="quiz-top__sub">Quiz completed. Review your answers and the correct answers below.</p>
            </div>
          </div>

          <div className="quiz-top__bar">
            <div className="quiz-filter" role="group" aria-label="Show questions">
              <button type="button" aria-pressed={show === 'all'} onClick={() => setShow('all')}>
                All <span>{questions.length}</span>
              </button>
              <button type="button" aria-pressed={show === 'wrong'} onClick={() => setShow('wrong')} disabled={wrongCount === 0}>
                Missed <span>{wrongCount}</span>
              </button>
              <button type="button" aria-pressed={show === 'right'} onClick={() => setShow('right')} disabled={rightCount === 0}>
                Right <span>{rightCount}</span>
              </button>
            </div>
            <nav className="quiz-jump" aria-label="Jump to a question">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`quiz-jump__dot ${right[i] ? 'is-right' : 'is-wrong'}`}
                  aria-label={`Question ${i + 1}: ${right[i] ? 'correct' : 'incorrect'}`}
                  onClick={() => {
                    setShow('all')
                    // after the list is complete again
                    setTimeout(() => jumpTo(`${prefix}${i}`), 0)
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <ol className="quiz-questions">
          {listed.map(({ q, i }) => {
            const chosen = attempt.answers[i]
            const correct = q.correct
            const isRight = right[i]
            return (
              <li key={q.id} id={`${prefix}${i}`} className={`quiz-question${correct !== undefined ? (isRight ? ' is-right' : ' is-wrong') : ''}`}>
                <div className="quiz-question__head">
                  <span className="quiz-question__num">{i + 1}</span>
                  <p className="quiz-question__prompt">{q.prompt}</p>
                  {correct !== undefined && <span className={`pill ${isRight ? 'pill--ok' : 'pill--danger'}`}>{isRight ? 'Correct' : 'Incorrect'}</span>}
                </div>
                <ul className="quiz-options">
                  {q.options.map((opt, optIdx) => {
                    const isChosen = chosen === optIdx
                    const isCorrectOption = correct === optIdx
                    const state = isCorrectOption ? 'quiz-option--correct' : isChosen ? 'quiz-option--wrong' : ''
                    return (
                      <li key={optIdx} className={`quiz-option quiz-option--review ${state}`}>
                        <span className="quiz-option__letter">{letter(optIdx)}</span>
                        <span className="quiz-option__body">
                          <span className="quiz-option__text">{opt}</span>
                          {isCorrectOption && isChosen && <span className="quiz-option__tag">Your answer · Correct</span>}
                          {isCorrectOption && !isChosen && <span className="quiz-option__tag">Correct answer</span>}
                          {!isCorrectOption && isChosen && <span className="quiz-option__tag quiz-option__tag--wrong">Your answer</span>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ol>

        <div className="quiz-foot">
          <span className="quiz-foot__hint">{show === 'all' ? '' : `Showing ${listed.length} of ${questions.length} questions`}</span>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    )
  }

  const answeredCount = answers.filter((a) => a !== null).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length
  const left = questions.length - answeredCount

  async function handleFinish(e: FormEvent) {
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
      <div className="quiz-top">
        {quiz.description && <p className="quiz-top__sub">{quiz.description}</p>}
        <div className="quiz-progress">
          <p className="quiz-progress__label">
            Answered {answeredCount} of {questions.length}
          </p>
          <div className="quiz-progress__track" aria-hidden="true">
            <span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
          </div>
        </div>
        <nav className="quiz-jump" aria-label="Jump to a question">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              className={`quiz-jump__dot${answers[i] !== null ? ' is-done' : ''}`}
              aria-label={`Question ${i + 1}${answers[i] !== null ? ', answered' : ', not answered'}`}
              onClick={() => jumpTo(`${prefix}${i}`)}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      </div>

      <ol className="quiz-questions">
        {questions.map((q, qIdx) => (
          <li key={q.id} id={`${prefix}${qIdx}`} className={`quiz-question${answers[qIdx] !== null ? ' is-answered' : ''}`}>
            <fieldset className="quiz-fieldset">
              <legend className="quiz-question__head">
                <span className="quiz-question__num">{qIdx + 1}</span>
                <span className="quiz-question__prompt">{q.prompt}</span>
              </legend>
              <div className="quiz-options">
                {q.options.map((opt, optIdx) => {
                  const selected = answers[qIdx] === optIdx
                  return (
                    <label key={optIdx} className={`quiz-option ${selected ? 'quiz-option--selected' : ''}`}>
                      <input
                        type="radio"
                        name={`quiz-q-${q.id}`}
                        checked={selected}
                        onChange={() => setAnswers((prev) => prev.map((val, idx) => (idx === qIdx ? optIdx : val)))}
                      />
                      <span className="quiz-option__letter">{letter(optIdx)}</span>
                      <span className="quiz-option__body">
                        <span className="quiz-option__text">{opt}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="quiz-foot">
        <span className="quiz-foot__hint" aria-live="polite">
          {error ? (
            <span className="field__error" role="alert">
              {error}
            </span>
          ) : allAnswered ? (
            <>
              <Icon name="check" size={16} /> All answered. You can finish.
            </>
          ) : (
            `${left} ${left === 1 ? 'question' : 'questions'} left`
          )}
        </span>
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
