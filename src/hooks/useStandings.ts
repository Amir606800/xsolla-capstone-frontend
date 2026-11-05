import { useContext } from 'react'
import { StandingsContext } from '../context/standings'

export function useStandings() {
  const ctx = useContext(StandingsContext)
  if (!ctx) throw new Error('useStandings must be used inside <StandingsProvider>')
  return ctx
}
