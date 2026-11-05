import { memo } from 'react'
import type { QuizItem } from '../../types/course'
import { formatDateTime } from '../../utils/date'
import { Icon } from '../Icon'

/**
 * The module's quizzes, written by the lecturer. Taking a quiz is not built yet, so students
 * only see what is coming (title, number of questions, due date).
 */
function QuizzesCardBase({ quizzes = [] }: { quizzes?: QuizItem[] }) {
  return (
    <section className="card" aria-labelledby="quizzes-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="sparkle" size={20} />
        </span>
        <h2 id="quizzes-title">Quizzes</h2>
        <span className="pill">Coming soon</span>
      </header>
      {quizzes.length === 0 ? (
        <p className="card__empty">No quizzes in this module yet.</p>
      ) : (
        <ul className="list">
          {quizzes.map((q) => {
            const n = q.questions?.length ?? 0
            return (
              <li key={q.id} className="list__row">
                <div>
                  <p className="list__title">{q.title}</p>
                  <p className="list__meta">
                    {n} {n === 1 ? 'question' : 'questions'}
                    {q.dueAt ? ` · due ${formatDateTime(q.dueAt)}` : ''}
                  </p>
                  {q.description && <p className="list__meta">{q.description}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export const QuizzesCard = memo(QuizzesCardBase)
