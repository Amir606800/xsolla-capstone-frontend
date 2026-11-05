import type { WidgetId } from '../../config/dashboardWidgets'
import type { CourseModule } from '../../types/course'
import type { ActivityEntry, DeadlineEntry, GradeEntry, OverallStats } from '../../utils/progress'
import { CurrentTaskCard } from './CurrentTaskCard'
import { DeadlinesCard } from './DeadlinesCard'
import { ProgressCard } from './ProgressCard'
import { RecentActivityCard } from './RecentActivityCard'
import { RecentGradesCard } from './RecentGradesCard'

/** Everything the widgets show, computed once by the page. */
export interface DashboardData {
  modules: CourseModule[]
  now: Date
  stats: OverallStats
  deadlines: DeadlineEntry[]
  grades: GradeEntry[]
  activity: ActivityEntry[]
  isLocked: (m: CourseModule) => boolean
}

/** Maps a widget id to its content. A new widget = one case here + one entry in config/dashboardWidgets. */
export function DashboardWidgetBody({ id, data }: { id: WidgetId; data: DashboardData }) {
  switch (id) {
    case 'progress':
      return <ProgressCard stats={data.stats} modules={data.modules} now={data.now} isLocked={data.isLocked} />
    case 'current-task':
      return <CurrentTaskCard />
    case 'deadlines':
      return <DeadlinesCard entries={data.deadlines} now={data.now} />
    case 'grades':
      return <RecentGradesCard entries={data.grades} />
    case 'activity':
      return <RecentActivityCard entries={data.activity} now={data.now} />
  }
}
