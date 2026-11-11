import type { ModulePatch } from '../mocks/contentEdits'
import type { CourseModule } from '../types/course'

/** The same moment, whatever the format the server writes it in. */
const sameInstant = (a: string | undefined, b: string) => a !== undefined && new Date(a).getTime() === new Date(b).getTime()

export const DATES_NOT_KEPT = 'The server does not store week dates yet, so the open and close dates were not saved.'

/**
 * The server answers 200 to week dates it cannot store (it ignores fields it does not know), so after a save the
 * caller checks what came back: a warning when dates were asked for but are not there.
 */
export function datesNotKept(patch: ModulePatch, saved: CourseModule | undefined): string | undefined {
  const lost = (['opensAt', 'closesAt'] as const).some((k) => {
    const asked = patch[k]
    return !!asked && !sameInstant(saved?.[k], asked)
  })
  return lost ? DATES_NOT_KEPT : undefined
}
