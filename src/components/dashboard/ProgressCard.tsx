import { memo } from 'react'
import type { CourseModule } from '../../types/course'
import type { OverallStats } from '../../utils/progress'
import { Icon } from '../Icon'
import { JourneyPath } from './JourneyPath'
import { ScoreCard } from './ScoreCard'

interface Props {
  stats: OverallStats
  modules: CourseModule[]
  now: Date
  isLocked: (m: CourseModule) => boolean
}

/** The big "Progress" widget: score, task counts and the path through the modules. */
function ProgressCardBase({ stats, modules, now, isLocked }: Props) {
  return (
    <section className="card card--progress" aria-labelledby="progress-title">
      <header className="card__head">
        <span className="card__icon card__icon--accent">
          <Icon name="check" size={20} />
        </span>
        <h2 id="progress-title">Progress</h2>
      </header>
      <div className="progress">
        <ScoreCard stats={stats} />
        <div className="progress__path">
          <JourneyPath modules={modules} now={now} isLocked={isLocked} />
        </div>
      </div>
    </section>
  )
}

export const ProgressCard = memo(ProgressCardBase)
