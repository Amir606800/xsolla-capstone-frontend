import { createContext } from 'react'
import type { WeeklyStanding } from '../types/standing'
import type { StandingSummary } from '../utils/standing'
import type { LoadStatus } from './courses'

export interface StandingsContextValue {
  status: LoadStatus
  /** The mentor's ratings, oldest first. */
  ratings: WeeklyStanding[]
  /** The ratings with the program rules applied (4 yellow in a row = red, 2 red in a row = removal). */
  summary: StandingSummary
  reload: () => void
  /** A screen that uses the standings calls this while it is open; they refresh themselves only then. Returns the stop function. */
  watch: () => () => void
}

export const StandingsContext = createContext<StandingsContextValue | null>(null)
