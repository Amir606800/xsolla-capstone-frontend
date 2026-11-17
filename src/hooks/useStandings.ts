import { useContext, useEffect } from 'react'
import { StandingsContext } from '../context/standings'

/** The standings. They keep themselves up to date while the calling screen is open (not while nobody reads them). */
export function useStandings() {
  const ctx = useContext(StandingsContext)
  const watch = ctx?.watch
  useEffect(() => watch?.(), [watch])
  if (!ctx) throw new Error('useStandings must be used inside <StandingsProvider>')
  return ctx
}
