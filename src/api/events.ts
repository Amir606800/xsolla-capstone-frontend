/**
 * Calendar events (./events.http). Task deadlines and 1:1 times are NOT part of this list; the client derives them from
 * tasks and slots. Each call returns the whole updated list.
 */
export { deleteEvent, fetchEvents, saveEvent } from './events.http'
