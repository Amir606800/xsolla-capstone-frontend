import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../types/calendar'
import { JoinMeeting } from './JoinMeeting'

const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m)
const MEET = 'https://meet.google.com/abc-defg-hij'
const lecture: CalendarEvent = { id: 'l', title: 'Lecture', kind: 'lecture', startsAt: at(10).toISOString(), endsAt: at(12).toISOString(), meetingUrl: MEET }

describe('JoinMeeting', () => {
  it('a student gets a Join button that opens the link in a new tab, from 30 minutes before', () => {
    render(<JoinMeeting event={lecture} now={at(9, 35)} />)
    const join = screen.getByRole('link', { name: /Join Google Meet/ })
    expect(join).toHaveAttribute('href', MEET)
    expect(join).toHaveAttribute('target', '_blank')
    expect(join).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('too early: no link at all, only when it will appear', () => {
    render(<JoinMeeting event={lecture} now={at(8)} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('note')).toHaveTextContent('The link to join appears 30 minutes before the start, at 09:30.')
    expect(document.body.innerHTML).not.toContain('meet.google.com')
  })

  it('after the lecture there is nothing for a student', () => {
    const { container } = render(<JoinMeeting event={lecture} now={at(13)} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('staff always see the link, with a hint about when students do', () => {
    const { rerender } = render(<JoinMeeting event={lecture} now={at(8)} always />)
    expect(screen.getByRole('link', { name: /Open Google Meet link/ })).toHaveAttribute('href', MEET)
    expect(screen.getByText('Students see it from 09:30.')).toBeInTheDocument()
    rerender(<JoinMeeting event={lecture} now={at(13)} always />)
    expect(screen.getByText('The lecture is over.')).toBeInTheDocument()
    rerender(<JoinMeeting event={lecture} now={at(10, 30)} always />)
    expect(screen.getByRole('link', { name: /Join Google Meet/ })).toBeInTheDocument()
  })

  it('a link that is not Google Meet is called "the meeting"; no link or an off-campus day shows nothing', () => {
    const { container, rerender } = render(<JoinMeeting event={{ ...lecture, meetingUrl: 'https://zoom.us/j/1' }} now={at(10)} />)
    expect(screen.getByRole('link', { name: /Join the meeting/ })).toBeInTheDocument()
    rerender(<JoinMeeting event={{ ...lecture, meetingUrl: undefined }} now={at(10)} always />)
    expect(container).toBeEmptyDOMElement()
    rerender(<JoinMeeting event={{ ...lecture, kind: 'off-campus' }} now={at(10)} always />)
    expect(container).toBeEmptyDOMElement()
  })
})
