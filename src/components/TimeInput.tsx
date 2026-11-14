import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { maskTime, normalizeTime, TIME_24H } from '../utils/time'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  /** "HH:MM" (24-hour), or "" for no time (also while what is typed is not a time yet). */
  value: string
  onChange: (value: string) => void
}

/**
 * A time of day, always on the 24-hour clock ("08:00", "18:30"). The browser's own time field follows the device's
 * language and shows AM/PM on many computers, so the app does not use it. The value is the same "HH:MM" text, and ""
 * until a whole valid time is typed; on leaving the field a short entry is completed ("9" becomes "09:00").
 */
export function TimeInput({ value, onChange, onBlur, ...rest }: Props) {
  const [text, setText] = useState(value)
  const [left, setLeft] = useState(false)

  // a change from outside (another event picked, a reset) replaces what is shown
  const typed = TIME_24H.test(text) ? text : ''
  if (value !== typed) setText(value)

  const invalid = left && text !== '' && !TIME_24H.test(text)

  return (
    <input
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      aria-invalid={rest['aria-invalid'] ?? (invalid ? true : undefined)}
      {...rest}
      type="text"
      value={text}
      onChange={(e) => {
        const next = maskTime(e.target.value)
        setText(next)
        setLeft(false)
        onChange(TIME_24H.test(next) ? next : '')
      }}
      onBlur={(e) => {
        const done = normalizeTime(text)
        if (done) {
          setText(done)
          onChange(done)
        }
        setLeft(true)
        onBlur?.(e)
      }}
    />
  )
}
