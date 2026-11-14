import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { formatClockTime, formatDateTime } from '../utils/date'
import { maskTime, normalizeTime } from '../utils/time'
import { TimeInput } from './TimeInput'

function Harness({ start = '', seen }: { start?: string; seen?: (v: string) => void }) {
  const [value, setValue] = useState(start)
  return (
    <>
      <label>
        Starts
        <TimeInput value={value} onChange={(v) => (setValue(v), seen?.(v))} />
      </label>
      <button type="button" onClick={() => setValue('21:15')}>
        Set from outside
      </button>
    </>
  )
}

describe('TimeInput: the 24-hour clock, whatever the device language', () => {
  it('is a plain text field (the browser’s own time field shows AM/PM on many computers)', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Starts')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('placeholder', 'HH:MM')
  })

  it('typing digits makes "HH:MM"; the value is empty until it is a whole time', async () => {
    const seen: string[] = []
    render(<Harness seen={(v) => seen.push(v)} />)
    await userEvent.setup().type(screen.getByLabelText('Starts'), '1830')
    expect(screen.getByLabelText('Starts')).toHaveValue('18:30')
    expect(seen).toEqual(['', '', '', '18:30'])
  })

  it('a pasted or filled "07:00" works as it is', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '07:00' } })
    expect(screen.getByLabelText('Starts')).toHaveValue('07:00')
  })

  it('refuses an hour of 24 or more and minutes of 60 or more: the value stays empty and the field is marked', async () => {
    const seen: string[] = []
    render(<Harness seen={(v) => seen.push(v)} />)
    const input = screen.getByLabelText('Starts')
    await userEvent.setup().type(input, '2560')
    expect(seen.at(-1)).toBe('')
    fireEvent.blur(input)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('leaving the field completes a short entry: "9" becomes 09:00, "930" becomes 09:30', async () => {
    const seen: string[] = []
    render(<Harness seen={(v) => seen.push(v)} />)
    const input = screen.getByLabelText('Starts')
    await userEvent.setup().type(input, '9')
    fireEvent.blur(input)
    expect(input).toHaveValue('09:00')
    expect(seen.at(-1)).toBe('09:00')
    fireEvent.change(input, { target: { value: '930' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('09:30')
  })

  it('shows a time given from outside, and follows a later change', async () => {
    render(<Harness start="08:00" />)
    expect(screen.getByLabelText('Starts')).toHaveValue('08:00')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Set from outside' }))
    expect(screen.getByLabelText('Starts')).toHaveValue('21:15')
  })
})

describe('maskTime and normalizeTime', () => {
  it('mask: digits only, a colon after the hour', () => {
    expect(maskTime('')).toBe('')
    expect(maskTime('1')).toBe('1')
    expect(maskTime('18')).toBe('18')
    expect(maskTime('183')).toBe('18:3')
    expect(maskTime('18:30')).toBe('18:30')
    expect(maskTime('6:30pm')).toBe('63:0')
    expect(maskTime('1830999')).toBe('18:30')
  })

  it('normalize: a time, or nothing', () => {
    expect(normalizeTime('9')).toBe('09:00')
    expect(normalizeTime('14')).toBe('14:00')
    expect(normalizeTime('930')).toBe('09:30')
    expect(normalizeTime('0905')).toBe('09:05')
    expect(normalizeTime('23:59')).toBe('23:59')
    expect(normalizeTime('00:00')).toBe('00:00')
    expect(normalizeTime('24:00')).toBeNull()
    expect(normalizeTime('12:75')).toBeNull()
    expect(normalizeTime('')).toBeNull()
  })
})

describe('times shown anywhere in the app are 24-hour', () => {
  it('midnight is 00:00, not 24:00 (and the afternoon is 14:00, not 2:00 PM)', () => {
    const midnight = new Date(2026, 10, 15, 0, 5).toISOString()
    const afternoon = new Date(2026, 10, 15, 14, 30).toISOString()
    expect(formatClockTime(midnight)).toBe('00:05')
    expect(formatClockTime(afternoon)).toBe('14:30')
    expect(formatDateTime(midnight)).toBe('Nov 15, 00:05')
    expect(formatDateTime(afternoon)).toBe('Nov 15, 14:30')
  })
})
