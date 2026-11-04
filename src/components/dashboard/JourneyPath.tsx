import { memo, useMemo } from 'react'
import type { CourseModule } from '../../types/course'
import { isActiveModule, moduleProgress, nextDeadline } from '../../utils/progress'
import { ModuleNode } from './ModuleNode'

const PER_ROW = 4

interface JourneyPathProps {
  modules: CourseModule[]
  now: Date
  /** Which modules the viewer may not open yet (see useModuleAccess). */
  isLocked: (module: CourseModule) => boolean
}

/**
 * Winding path of modules: rows of 4, alternating direction (snake) with a
 * curved connector at each row end. Layout is pure CSS; below ~640px the
 * container query turns it into a vertical timeline.
 */
function JourneyPathBase({ modules, now, isLocked }: JourneyPathProps) {
  const rows = useMemo(() => {
    const nodes = modules.map((module) => {
      const locked = isLocked(module)
      return {
        module,
        locked,
        active: !locked && isActiveModule(module, now),
        progress: moduleProgress(module, now),
        // a locked module must not leak its tasks, so no deadline badge
        deadline: locked ? null : nextDeadline(module, now),
      }
    })
    const out: (typeof nodes)[] = []
    for (let i = 0; i < nodes.length; i += PER_ROW) out.push(nodes.slice(i, i + PER_ROW))
    return out
  }, [modules, now, isLocked])

  return (
    <ol className="path" aria-label="Course modules">
      {rows.map((row, r) => (
        <li
          key={r}
          className={`path__row${r % 2 === 1 ? ' is-reversed' : ''}${r === rows.length - 1 ? ' is-last' : ''}`}
          style={{ ['--n' as string]: row.length }}
        >
          <ul>
            {row.map(({ module, progress, deadline, locked, active }) => (
              <li key={module.id}>
                <ModuleNode
                  module={module}
                  progress={progress}
                  deadline={deadline}
                  locked={locked}
                  active={active}
                  now={now}
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

export const JourneyPath = memo(JourneyPathBase)
