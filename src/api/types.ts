/**
 * Wire formats from the backend (see DESIGN.md sections 3, 7, 8).
 * Fields marked "inferred" are not spelled out in the design doc yet -
 * confirm against the real API and adjust here only; the rest of the app
 * uses the domain types in `src/types/course.ts`.
 */

/** bigint ids may arrive as numbers or strings depending on the JSON encoder. */
export type ApiId = number | string

export interface ApiCourse {
  id: ApiId
  title: string
  description: string | null
  created_by: ApiId
  created_at: string
}

interface ApiContentItemBase {
  id: ApiId
  title: string
  description?: string | null // inferred
  position: number
  is_visible: boolean
}

export interface ApiSection extends ApiContentItemBase {
  type: 'section'
  /** inferred: the schema has no module dates yet (product doc: a Week has a date range) */
  starts_at?: string | null
  ends_at?: string | null
  children: ApiContentItem[]
}

export interface ApiFileItem extends ApiContentItemBase {
  type: 'file'
  file_id: ApiId
  /** inferred: original file name / mime, used to pick the resource kind */
  mime_type?: string | null
}

export interface ApiAssignmentItem extends ApiContentItemBase {
  type: 'assignment'
  due_at: string
  /** Not used: work is rated green/yellow/red, not with points. */
  max_points?: number
}

export type ApiContentItem = ApiSection | ApiFileItem | ApiAssignmentItem

/** POST /files, GET /files/:id */
export interface ApiFile {
  id: ApiId
  original_name: string
  mime_type: string
  size_bytes: number
}

/** GET /content-items/:id/submissions/me, POST .../submissions */
export interface ApiSubmission {
  id: ApiId
  assignment_id: ApiId
  text_body: string | null
  submitted_at: string
  /** Not used: the green/yellow/red rating is given per week (see ApiWeeklyStanding), not per task. */
  grade?: unknown
  feedback: string | null
  graded_at: string | null
  files?: { id: ApiId; original_name: string }[] | null
}

/** GET /standings/me (inferred, the backend has no such endpoint yet): the mentor's rating of each finished week */
export interface ApiWeeklyStanding {
  /** Module position (1-12): a module is a week */
  week: number
  /** 'green' | 'yellow' | 'red' */
  level: string
  assessed_at: string
  note?: string | null
}
