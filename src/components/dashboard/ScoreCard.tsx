import { memo } from 'react'
import { standingAlert } from '../../utils/standing'
import type { StandingSummary } from '../../utils/standing'
import type { OverallStats } from '../../utils/progress'
import { StandingBadge } from '../StandingBadge'
import { StandingBar } from '../StandingBar'
import { StatBar } from './StatBar'

function ScoreCardBase({ stats, standing }: { stats: OverallStats; standing: StandingSummary }) {
  const alert = standingAlert(standing)

  return (
    <div className="score">
      <div className="score__ring">
        <StandingBadge standing={standing.current} />
        <span className="score__label">My standing</span>
      </div>

      {alert && <p className={`standing-alert standing-alert--${alert.tone}`}>{alert.text}</p>}

      <StandingBar counts={standing.counts} />

      <div className="score__stats">
        <StatBar label="Modules" value={stats.modulesDone} max={stats.modulesTotal} />
        <StatBar label="Tasks" value={stats.tasksSubmitted} max={stats.tasksTotal} />
        <StatBar label="Quizzes" value={0} max={0} placeholder="Coming soon" />
      </div>
    </div>
  )
}

export const ScoreCard = memo(ScoreCardBase)
