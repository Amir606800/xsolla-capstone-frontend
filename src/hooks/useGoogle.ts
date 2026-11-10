import { useContext, useEffect } from 'react'
import { GoogleContext } from '../context/google'

/** The Google Calendar connection. By default the screen using it makes sure the status has been loaded. */
export function useGoogle({ load = true }: { load?: boolean } = {}) {
  const ctx = useContext(GoogleContext)
  if (!ctx) throw new Error('useGoogle must be used inside <GoogleProvider>')
  const ask = ctx.load
  useEffect(() => {
    if (load) ask()
  }, [load, ask])
  return ctx
}
