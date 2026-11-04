import { memo, useMemo } from 'react'
import type { CourseModule } from '../../types/course'
import { moduleProgress, nextDeadline } from '../../utils/progress'
import { ModuleNode } from './ModuleNode'

const PER_ROW = 4

interface JourneyPathProps {
  modules: CourseModule[]
  now: Date
}

/**
 * Winding path of modules: rows of 4, alternating direction (snake) with a
 * curved connector at each row end. Layout is pure CSS; below ~640px the
 * container query turns it into a vertical timeline.
 */
function JourneyPathBase({ modules, now }: JourneyPathProps) {
  const rows = useMemo(() => {
    const nodes = modules.map((module) => ({
      module,
      progress: moduleProgress(module, now),
      deadline: nextDeadline(module, now),
    }))
    const out: (typeof nodes)[] = []
    for (let i = 0; i < nodes.length; i += PER_ROW) out.push(nodes.slice(i, i + PER_ROW))
    return out
  }, [modules, now])

  return (
    <ol className="path" aria-label="Course modules">
      {rows.map((row, r) => (
        <li
          key={r}
          className={`path__row${r % 2 === 1 ? ' is-reversed' : ''}${r === rows.length - 1 ? ' is-last' : ''}`}
          style={{ ['--n' as string]: row.length }}
        >
          <ul>
            {row.map(({ module, progress, deadline }) => (
              <li key={module.id}>
                <ModuleNode module={module} progress={progress} deadline={deadline} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

export const JourneyPath = memo(JourneyPathBase)
