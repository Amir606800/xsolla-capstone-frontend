import { memo } from 'react'
import type { CourseModule } from '../../types/course'
import type { OverallStats } from '../../utils/progress'
import type { StandingSummary } from '../../utils/standing'
import { Icon } from '../Icon'
import { JourneyPath } from './JourneyPath'
import { ScoreCard } from './ScoreCard'

interface Props {
  stats: OverallStats
  standing: StandingSummary
  modules: CourseModule[]
  now: Date
  isLocked: (m: CourseModule) => boolean
}

/** The big "Progress" widget: score, task counts and the path through the modules. */
function ProgressCardBase({ stats, standing, modules, now, isLocked }: Props) {
  return (
    <section className="card card--progress" aria-labelledby="progress-title">
      <header className="card__head">
        <span className="card__icon card__icon--accent">
          <Icon name="check" size={20} />
        </span>
        <h2 id="progress-title">Progress</h2>
      </header>
      <div className="progress">
        <ScoreCard stats={stats} standing={standing} />
        <div className="progress__path">
          <JourneyPath modules={modules} now={now} isLocked={isLocked} />
        </div>
      </div>
    </section>
  )
}

export const ProgressCard = memo(ProgressCardBase)
