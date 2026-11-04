import { memo } from 'react'
import { Icon } from '../Icon'

/** Reserved slot. Quizzes (AI-generated) are planned but not designed yet. */
function QuizzesCardBase() {
  return (
    <section className="card" aria-labelledby="quizzes-title">
      <header className="card__head">
        <span className="card__icon">
          <Icon name="sparkle" size={20} />
        </span>
        <h2 id="quizzes-title">Quizzes</h2>
        <span className="pill">Coming soon</span>
      </header>
      <p className="card__empty">AI-generated quizzes for this module will appear here.</p>
    </section>
  )
}

export const QuizzesCard = memo(QuizzesCardBase)
