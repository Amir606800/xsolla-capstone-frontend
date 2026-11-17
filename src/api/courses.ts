import type { ContentItem, CourseModule, ModulePatch, Submission, SubmissionFile } from '../types/course'
import * as http from './courses.http'

/**
 * The course: modules (weeks), their items, hand-ins and quizzes (./courses.http). Each authoring call returns the whole
 * updated course (all modules), like a refetch would. The backend has no place yet for week dates on every server: they
 * are sent and checked afterwards (datesNotKept).
 */
export type { ModulePatch }

/** `student`: the student's own hand-ins come with the tasks. Staff get the course without anyone's work. */
export async function fetchModules(opts: { student?: boolean; userId?: number } = {}): Promise<CourseModule[]> {
  return http.fetchModules(opts.student ?? false)
}

export interface SubmitPayload {
  textBody: string
  /** New files to upload. */
  files: File[]
  /** Files of the current version that are handed in again with the new one. */
  keep?: SubmissionFile[]
}

/** Who hands in, and the module the task belongs to (the backend's URL needs it). */
export interface SubmitContext {
  studentId?: number
  moduleId?: string
}

export async function submitWork(assignmentId: string, payload: SubmitPayload, ctx: SubmitContext = {}): Promise<Submission> {
  if (!ctx.moduleId) throw new Error('This task has no module')
  return http.submitWork(ctx.moduleId, assignmentId, payload)
}

export async function saveModule(id: string, patch: ModulePatch): Promise<CourseModule[]> {
  return http.saveModule(id, patch)
}

export async function saveItem(item: ContentItem): Promise<CourseModule[]> {
  return http.saveItem(item)
}

/** A new module. Returns its id and the module itself (not the whole course). (`createdBy`: the server takes it from the session.) */
export async function createModule(patch: ModulePatch & { title: string }, ctx: { createdBy?: number } = {}): Promise<{ id: string; module: CourseModule }> {
  void ctx
  return http.createModule(patch)
}

/**
 * The two steps of importing a module template, without reloading the course after each (a reload is a request per
 * module): make a module and return its id, and save one item in it. The caller reloads once at the end.
 */
export async function createModuleQuiet(patch: ModulePatch & { title: string }, ctx: { createdBy?: number } = {}): Promise<string> {
  void ctx
  return http.postModule(patch)
}

export async function writeItemQuiet(item: ContentItem): Promise<void> {
  return http.writeItem(item)
}

/** Adds a lecturer to a week (module), or takes them off it (`assigned: false`); the others stay. Returns the whole course. */
export async function assignLecturer(moduleId: string, lecturerId: number, assigned = true): Promise<CourseModule[]> {
  return http.assignLecturer(moduleId, lecturerId, assigned)
}

/** Admins (and the module's creator): the module and everything in it. */
export async function deleteModule(id: string): Promise<CourseModule[]> {
  return http.deleteModule(id)
}

export async function deleteItem(id: string): Promise<CourseModule[]> {
  return http.deleteItem(id)
}

/** The server writes the quiz from the material (its AI); the quiz shows as "generating" until it is ready. */
export async function generateAiQuiz(
  input: { moduleId: string; contentItemId: string; title?: string; dueAt?: string },
  ctx: { createdBy?: number } = {},
): Promise<{ quizId: string; modules: CourseModule[] }> {
  void ctx
  return http.generateAiQuiz(input)
}

export async function submitQuizAttempt(quizId: string, answers: number[], ctx: { studentId?: number } = {}): Promise<CourseModule[]> {
  void ctx
  return http.submitQuizAttempt(quizId, answers)
}
