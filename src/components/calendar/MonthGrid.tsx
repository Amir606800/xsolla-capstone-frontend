import { memo, useMemo } from 'react'
import type { CalendarEvent } from '../../types/calendar'
import { WEEKDAYS, dateKey, monthGrid } from '../../utils/calendar'
import { DayCell } from './DayCell'

interface MonthGridProps {
  month: Date
  today: Date
  selected: string
  eventsByDay: Record<string, CalendarEvent[]>
  /** Optional range of days to tint ("yyyy-mm-dd", inclusive). */
  range?: { from: string; to: string }
  onSelect: (key: string, extend: boolean) => void
}

function MonthGridBase({ month, today, selected, eventsByDay, range, onSelect }: MonthGridProps) {
  const days = useMemo(() => monthGrid(month), [month])
  const todayKey = dateKey(today)

  return (
    <div className="month" role="group" aria-label="Month view">
      <div className="month__weekdays" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month__days">
        {days.map((date) => {
          const key = dateKey(date)
          return (
            <DayCell
              key={key}
              date={date}
              inMonth={date.getMonth() === month.getMonth()}
              isToday={key === todayKey}
              selected={key === selected}
              inRange={!!range && key >= range.from && key <= range.to}
              events={eventsByDay[key]}
              now={today}
              onSelect={onSelect}
            />
          )
        })}
      </div>
    </div>
  )
}

export const MonthGrid = memo(MonthGridBase)
