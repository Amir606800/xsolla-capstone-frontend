import { useCallback, useEffect, useState } from 'react'
import { createStaff, createStudent, deleteAccount, fetchTeams, fetchUsers, setStudentLeft, setUserRoles, updateMentor, updateStudent } from '../api/directory'
import type { MentorChanges, NewMentor, NewStudent, StudentChanges } from '../api/directory'
import type { Role } from '../types/user'
import type { LoadStatus } from '../context/courses'
import type { SchoolTeam, SchoolUser } from '../types/admin'

/**
 * The admin's people pages: everyone and the teams, loaded together. Teams are optional: if they
 * cannot be loaded the people still show (without their team).
 */
export function useDirectory() {
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [users, setUsers] = useState<SchoolUser[]>([])
  const [teams, setTeams] = useState<SchoolTeam[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([fetchUsers(), fetchTeams().catch(() => [] as SchoolTeam[])])
      .then(([u, t]) => {
        if (!alive) return
        setUsers(u)
        setTeams(t)
        setStatus('ready')
      })
      .catch(() => {
        if (alive) setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [attempt])

  const reload = useCallback(() => {
    setStatus('loading')
    setAttempt((a) => a + 1)
  }, [])

  /** Adds the student, then shows the lists as they are now. Rejects with the reason on failure. */
  const addStudent = useCallback(async (input: NewStudent) => {
    const user = await createStudent(input)
    const [u, t] = await Promise.all([fetchUsers().catch(() => null), fetchTeams().catch(() => null)])
    // the backend may not list users yet: keep the new one on screen anyway
    setUsers((prev) => u ?? [...prev, user].sort((a, b) => a.name.localeCompare(b.name)))
    if (t) setTeams(t)
    return user
  }, [])

  /** After a change: show the lists as the server has them now. */
  const refresh = useCallback(async () => {
    const [u, t] = await Promise.all([fetchUsers().catch(() => null), fetchTeams().catch(() => null)])
    if (u) setUsers(u)
    if (t) setTeams(t)
  }, [])

  const editStudent = useCallback(
    async (id: number, changes: StudentChanges) => {
      await updateStudent(id, changes)
      await refresh()
    },
    [refresh],
  )
  const markLeft = useCallback(
    async (id: number, left: boolean) => {
      await setStudentLeft(id, left)
      await refresh()
    },
    [refresh],
  )
  const removeAccount = useCallback(
    async (id: number) => {
      await deleteAccount(id)
      await refresh()
    },
    [refresh],
  )
  const addStaff = useCallback(
    async (input: NewMentor, role: 'mentor' | 'lecturer') => {
      const user = await createStaff(input, role)
      await refresh()
      // the backend may not list users yet: keep the new one on screen anyway
      setUsers((prev) => (prev.some((u) => u.id === user.id) ? prev : [...prev, user].sort((a, b) => a.name.localeCompare(b.name))))
      return user
    },
    [refresh],
  )
  const addMentor = useCallback((input: NewMentor) => addStaff(input, 'mentor'), [addStaff])
  const addLecturer = useCallback((input: NewMentor) => addStaff(input, 'lecturer'), [addStaff])
  const editMentor = useCallback(
    async (id: number, changes: MentorChanges) => {
      await updateMentor(id, changes)
      await refresh()
    },
    [refresh],
  )
  const changeRoles = useCallback(
    async (id: number, roles: Role[], until: Partial<Record<Role, string>>) => {
      await setUserRoles(id, roles, until)
      await refresh()
    },
    [refresh],
  )

  return { status, users, teams, reload, addStudent, editStudent, markLeft, removeStudent: removeAccount, removeAccount, addMentor, addLecturer, editMentor, changeRoles }
}
