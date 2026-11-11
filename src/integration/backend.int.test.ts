import { beforeAll, describe, expect, it } from 'vitest'
import { login } from '../api/auth.http'
import { authedRequest } from '../api/authed'
import * as courses from '../api/courses'
import * as directory from '../api/directory'
import * as events from '../api/events'
import { fetchMyTeam, fetchMentorTeam } from '../api/teams'
import type { AssignmentItem, CourseModule, ResourceItem } from '../types/course'
import type { User } from '../types/user'

/**
 * The app's own API code against a real backend: every call the screens make, and a read-back to check that what
 * was saved is what the screen showed. A failing test here is a place where the app and the server disagree.
 * Run with `npm run test:backend` (see vitest.backend.config.ts). Skipped without LMS_API_URL.
 */
const API = process.env.LMS_API_URL
const ADMIN = { email: process.env.LMS_ADMIN_EMAIL ?? '', password: process.env.LMS_ADMIN_PASSWORD ?? '' }
const run = API && ADMIN.email ? describe : describe.skip

const stamp = Date.now().toString(36)
const PASSWORD = 'Zebra-Quartz-7781'
const people = {
  student: { name: 'Int Student', email: `int.student.${stamp}@example.com` },
  mentor: { name: 'Int Mentor', email: `int.mentor.${stamp}@example.com` },
  lecturer: { name: 'Int Lecturer', email: `int.lecturer.${stamp}@example.com` },
}
const ids: Partial<Record<keyof typeof people, number>> = {}

const inDays = (d: number, h = 18) => {
  const t = new Date()
  t.setDate(t.getDate() + d)
  t.setHours(h, 0, 0, 0)
  return t.toISOString()
}
const sameInstant = (a: string | undefined, b: string) => a !== undefined && new Date(a).getTime() === new Date(b).getTime()

async function as(who: 'admin' | keyof typeof people): Promise<User> {
  localStorage.clear()
  return who === 'admin' ? login(ADMIN.email, ADMIN.password) : login(people[who].email, PASSWORD)
}

run('the app against the real backend', () => {
  let moduleId = ''
  let teamId = ''
  let taskId = ''
  const findModule = (list: CourseModule[]) => list.find((m) => m.id === moduleId)

  beforeAll(async () => {
    const admin = await as('admin')
    expect(admin.roles).toContain('admin')
  })

  describe('admin: accounts', () => {
    it('creates a student (sign-up route), a mentor and a lecturer (POST /users)', async () => {
      await as('admin')
      ids.student = (await directory.createStudent({ ...people.student, password: PASSWORD, teamId: null })).id
      ids.mentor = (await directory.createStaff({ ...people.mentor, password: PASSWORD, teamId: null }, 'mentor')).id
      ids.lecturer = (await directory.createStaff({ ...people.lecturer, password: PASSWORD, teamId: null }, 'lecturer')).id
      expect(Object.values(ids).every((id) => id > 0)).toBe(true)
    })

    it('lists every account with roles (GET /users)', async () => {
      await as('admin')
      const users = await directory.fetchUsers()
      expect(users.find((u) => u.id === ids.mentor)?.roles).toEqual(['mentor'])
      expect(users.find((u) => u.id === ids.lecturer)?.roles).toEqual(['lecturer'])
      expect(users.find((u) => u.id === ids.student)?.roles).toEqual(['student'])
    })

    it('renames an account (PATCH /users/:id) and the list shows the new name', async () => {
      await as('admin')
      await directory.updateMentor(ids.mentor!, { name: 'Int Mentor Renamed', email: people.mentor.email, teamId: null })
      const users = await directory.fetchUsers()
      expect(users.find((u) => u.id === ids.mentor)?.name).toBe('Int Mentor Renamed')
    })

    it('gives the mentor the lecturer role for a while (PUT /users/:id/roles), and the end date comes back', async () => {
      await as('admin')
      const until = inDays(30, 0)
      await directory.setUserRoles(ids.mentor!, ['mentor', 'lecturer'], { lecturer: until })
      const mentor = (await directory.fetchUsers()).find((u) => u.id === ids.mentor)
      expect(mentor?.roles.sort()).toEqual(['lecturer', 'mentor'])
      expect(sameInstant(mentor?.roleUntil?.lecturer, until)).toBe(true)
      await directory.setUserRoles(ids.mentor!, ['mentor'])
    })

    it('resets a password (PUT /users/:id/password)', async () => {
      await as('admin')
      await directory.resetPassword(ids.lecturer!, PASSWORD)
    })

    it('every new account can sign in', async () => {
      for (const who of ['student', 'mentor', 'lecturer'] as const) expect((await as(who)).id).toBe(ids[who])
    })
  })

  describe('admin: teams', () => {
    it('adds a team with the student, and gives it the mentor (POST /teams, PUT /teams/:id/mentor)', async () => {
      await as('admin')
      const team = await directory.createTeam({ name: `Int Team ${stamp}`, mentorId: null, studentIds: [ids.student!] })
      teamId = team.id
      await directory.changeTeamMentor(teamId, ids.mentor!)
      const saved = (await directory.fetchTeams()).find((t) => t.id === teamId)
      expect(saved).toMatchObject({ mentorId: ids.mentor, studentIds: [ids.student] })
    })

    it('the student sees their team and mentor (GET /teams/me) - the "My team" page', async () => {
      const student = await as('student')
      const team = await fetchMyTeam(student)
      expect(team?.name).toBe(`Int Team ${stamp}`)
      expect(team?.mentor?.email).toBe(people.mentor.email)
    })

    it('the mentor sees their team (GET /mentors/me/team) - the mentor "My team" page', async () => {
      const mentor = await as('mentor')
      const team = await fetchMentorTeam(mentor)
      expect(team?.members.map((m) => m.email)).toContain(people.student.email)
    })
  })

  describe('modules (weeks), tasks and materials', () => {
    it('creates a module with its week dates, and the dates come back', async () => {
      await as('admin')
      const opensAt = inDays(1, 0)
      const closesAt = inDays(7, 23)
      const made = await courses.createModule({ title: `Int Week ${stamp}`, description: 'Integration', opensAt, closesAt })
      moduleId = made.id
      const saved = findModule(made.modules)
      expect(saved?.title).toBe(`Int Week ${stamp}`)
      expect(saved?.opensAt && sameInstant(saved.opensAt, opensAt)).toBe(true)
      expect(saved?.closesAt && sameInstant(saved.closesAt, closesAt)).toBe(true)
    })

    it('renames the module (PATCH /modules/:id)', async () => {
      await as('admin')
      const list = await courses.saveModule(moduleId, { title: `Int Week ${stamp} renamed`, description: 'Changed' })
      expect(findModule(list)).toMatchObject({ title: `Int Week ${stamp} renamed`, description: 'Changed' })
    })

    it('moves the module dates (PATCH /modules/:id)', async () => {
      await as('admin')
      const opensAt = inDays(2, 0)
      const list = await courses.saveModule(moduleId, { opensAt })
      expect(sameInstant(findModule(list)?.opensAt, opensAt)).toBe(true)
    })

    it('makes the lecturer the lecturer of the week', async () => {
      await as('admin')
      const list = await courses.assignLecturer(moduleId, ids.lecturer!)
      expect(findModule(list)?.createdBy).toBe(ids.lecturer)
    })

    it('adds a task with a deadline and requirements', async () => {
      await as('admin')
      const dueAt = inDays(5)
      const task: AssignmentItem = { id: `task-${stamp}`, moduleId, type: 'assignment', title: 'Int task', description: 'Do it', requirements: ['A repo link'], dueAt }
      const list = await courses.saveItem(task)
      const saved = findModule(list)?.items.find((i) => i.title === 'Int task') as AssignmentItem | undefined
      expect(saved).toBeDefined()
      taskId = saved!.id
      expect(sameInstant(saved!.dueAt, dueAt)).toBe(true)
      expect(saved!.requirements).toEqual(['A repo link'])
    })

    it('moves the deadline of a task (PATCH /content-items/:id)', async () => {
      await as('admin')
      const dueAt = inDays(6)
      const list = await courses.saveItem({ id: taskId, moduleId, type: 'assignment', title: 'Int task', dueAt })
      const saved = findModule(list)?.items.find((i) => i.id === taskId) as AssignmentItem
      expect(sameInstant(saved.dueAt, dueAt)).toBe(true)
    })

    it('adds a file material (POST /files + content item)', async () => {
      await as('admin')
      const upload = new File(['# Notes'], 'notes.md', { type: 'text/markdown' })
      const item: ResourceItem = { id: `res-${stamp}`, moduleId, type: 'resource', kind: 'md', title: 'notes.md', upload }
      const list = await courses.saveItem(item)
      const saved = findModule(list)?.items.find((i) => i.title === 'notes.md') as ResourceItem | undefined
      expect(saved?.fileId).toBeDefined()
    })

    it('adds a link material', async () => {
      await as('admin')
      const item: ResourceItem = { id: `link-${stamp}`, moduleId, type: 'resource', kind: 'link', title: 'Go docs', url: 'https://go.dev/doc/' }
      const list = await courses.saveItem(item)
      const saved = findModule(list)?.items.find((i) => i.title === 'Go docs') as ResourceItem | undefined
      expect(saved?.url).toBe('https://go.dev/doc/')
    })
  })

  describe('students: the course and handing in', () => {
    it('the student sees the new week and its task', async () => {
      await as('student')
      const list = await courses.fetchModules({ student: true })
      expect(findModule(list)?.items.some((i) => i.id === taskId)).toBe(true)
    })

    it('hands in text and a file, and gets it back', async () => {
      await as('student')
      const file = new File(['package main'], 'work.md', { type: 'text/markdown' })
      const sent = await courses.submitWork(taskId, { textBody: 'My work', files: [file] }, { moduleId })
      expect(sent.textBody).toBe('My work')
      const task = findModule(await courses.fetchModules({ student: true }))?.items.find((i) => i.id === taskId) as AssignmentItem
      expect(task.submission?.textBody).toBe('My work')
      expect(task.submission?.files?.map((f) => f.name)).toEqual(['work.md'])
    })

    it('downloads the file they handed in (GET /files/:id/download)', async () => {
      await as('student')
      const task = findModule(await courses.fetchModules({ student: true }))?.items.find((i) => i.id === taskId) as AssignmentItem
      const blob = await authedRequest<Blob>(`/files/${task.submission!.files![0].id}/download`, { as: 'blob' })
      expect(await blob.text()).toBe('package main')
    })

    it('hands in a second version, and the first one is kept as history', async () => {
      await as('student')
      await courses.submitWork(taskId, { textBody: 'Version 2', files: [] }, { moduleId })
      const task = findModule(await courses.fetchModules({ student: true }))?.items.find((i) => i.id === taskId) as AssignmentItem
      expect(task.submission?.textBody).toBe('Version 2')
      expect(task.submission?.history?.[0]?.textBody).toBe('My work')
    })
  })

  describe('calendar', () => {
    let eventId = ''

    it('a lecturer adds a lecture with a place and a description', async () => {
      await as('lecturer')
      const event = {
        id: `ev-${stamp}`,
        title: 'Int lecture',
        kind: 'lecture' as const,
        startsAt: inDays(3, 10),
        endsAt: inDays(3, 12),
        location: 'Main hall',
        description: 'Bring a laptop',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      }
      const result = await events.saveEvent(event)
      const saved = result.events.find((e) => e.title === 'Int lecture')
      expect(saved).toBeDefined()
      eventId = saved!.id
      expect(saved).toMatchObject({ location: 'Main hall', description: 'Bring a laptop' })
    })

    it('keeps the meeting link of the lecture', async () => {
      await as('lecturer')
      expect((await events.fetchEvents()).find((e) => e.id === eventId)?.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
    })

    it('links a lecture to a week the lecturer leads', async () => {
      await as('lecturer')
      const own = await courses.createModule({ title: `Int lecturer week ${stamp}` })
      const result = await events.saveEvent({ id: `ev2-${stamp}`, title: 'Int linked', kind: 'lecture', startsAt: inDays(3, 14), endsAt: inDays(3, 15), moduleId: own.id })
      expect(result.events.find((e) => e.title === 'Int linked')?.moduleId).toBe(own.id)
      await courses.deleteModule(own.id)
    })

    it('students see it', async () => {
      await as('student')
      expect((await events.fetchEvents()).some((e) => e.id === eventId)).toBe(true)
    })

    it('a lecturer can change an event of theirs that is not linked to a week', async () => {
      await as('lecturer')
      const current = (await events.fetchEvents()).find((e) => e.id === eventId)!
      await events.saveEvent({ ...current, title: 'Int lecture (moved)' })
      expect((await events.fetchEvents()).find((e) => e.id === eventId)?.title).toBe('Int lecture (moved)')
    })

    it('editing moves it and takes the place away (admin)', async () => {
      await as('admin')
      const current = (await events.fetchEvents()).find((e) => e.id === eventId)!
      await events.saveEvent({ ...current, startsAt: inDays(4, 10), endsAt: inDays(4, 12), location: undefined })
      const saved = (await events.fetchEvents()).find((e) => e.id === eventId)!
      expect(sameInstant(saved.startsAt, inDays(4, 10))).toBe(true)
      expect(saved.location).toBeUndefined()
    })

    it('the admin sees every event, also ones they did not make', async () => {
      await as('admin')
      expect((await events.fetchEvents()).some((e) => e.id === eventId)).toBe(true)
    })

    it('deleting removes it (admin)', async () => {
      await as('admin')
      await events.deleteEvent(eventId)
      expect((await events.fetchEvents()).some((e) => e.id === eventId)).toBe(false)
    })
  })

  describe('clean-up (also checks the delete routes)', () => {
    it('deletes the task and the module', async () => {
      await as('admin')
      await courses.deleteItem(taskId)
      const list = await courses.deleteModule(moduleId)
      expect(findModule(list)).toBeUndefined()
    })

    it('deletes the team (DELETE /teams/:id)', async () => {
      await as('admin')
      await directory.removeTeam(teamId)
      expect((await directory.fetchTeams()).some((t) => t.id === teamId)).toBe(false)
    })

    it('deletes the accounts (DELETE /users/:id)', async () => {
      await as('admin')
      for (const id of Object.values(ids)) await directory.deleteAccount(id)
      const left = (await directory.fetchUsers()).filter((u) => Object.values(ids).includes(u.id))
      expect(left).toEqual([])
    })
  })
})
