import { useState } from 'react'

/** Shared save state of a lecturer form: "touched" (show errors), busy, and the server's error. */
export function useSave() {
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  /** Runs `save` unless the form is invalid; errors from the server are shown under the form. */
  async function submit(invalid: boolean, save: () => Promise<void>) {
    setTouched(true)
    if (invalid || busy) return
    setBusy(true)
    setError(undefined)
    try {
      await save()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return { touched, busy, error, submit }
}
