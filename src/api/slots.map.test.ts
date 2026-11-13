import { describe, expect, it, vi } from 'vitest'

// the setup replaces ../api/slots with the demo store: take the real file to test its mapping
const { toMeetingSlot } = await vi.importActual<typeof import('./slots')>('./slots')

const row = { id: '13', mentor_id: 2, mentor_name: 'Rashid', starts_at: 'a', ends_at: 'b', booked: true }

describe('toMeetingSlot', () => {
  it('maps the Meet link and the people on the 1:1', () => {
    const s = toMeetingSlot({
      ...row,
      booked_by: 5,
      booked_by_name: 'User user',
      meeting_url: 'https://meet.google.com/abc-defg-hij',
      attendees: [
        { id: 2, name: 'Rashid', email: 'm@x.az' },
        { id: '5', name: 'User user', email: 'u@x.az' },
      ],
    })
    expect(s).toMatchObject({ id: '13', bookedBy: { id: 5, name: 'User user' }, meetingUrl: 'https://meet.google.com/abc-defg-hij' })
    expect(s.attendees?.map((a) => a.id)).toEqual([2, 5])
  })

  it('what another student is not allowed to see is simply absent', () => {
    const s = toMeetingSlot({ ...row, attendees: [{ id: 2, name: 'Rashid', email: 'm@x.az' }] })
    expect(s.bookedBy).toBeUndefined()
    expect(s.meetingUrl).toBeUndefined()
    expect(s.attendees).toHaveLength(1)
  })

  it('missing or null attendees are fine', () => {
    expect(toMeetingSlot(row)).not.toHaveProperty('attendees')
    expect(toMeetingSlot({ ...row, attendees: null, meeting_url: null })).not.toHaveProperty('meetingUrl')
  })
})
