import { memo } from 'react'
import type { OverallStats } from '../../utils/progress'
import { ProgressRing } from './ProgressRing'
import { StatBar } from './StatBar'

function ScoreCardBase({ stats }: { stats: OverallStats }) {
  return (
    <div className="score">
      <div className="score__ring">
        <ProgressRing percent={stats.scorePercent} size={164} stroke={14}>
          <span className="score__percent">{stats.scorePercent}%</span>
        </ProgressRing>
        <span className="score__label">My score</span>
      </div>

      <div className="score__stats">
        <StatBar label="Modules" value={stats.modulesDone} max={stats.modulesTotal} />
        <StatBar label="Tasks" value={stats.tasksSubmitted} max={stats.tasksTotal} />
        <StatBar label="Quizzes" value={0} max={0} placeholder="Coming soon" />
      </div>
    </div>
  )
}

export const ScoreCard = memo(ScoreCardBase)
