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
  max_points: number
}

export type ApiContentItem = ApiSection | ApiFileItem | ApiAssignmentItem

/** GET /content-items/:id/submissions/me */
export interface ApiSubmission {
  id: ApiId
  assignment_id: ApiId
  text_body: string | null
  submitted_at: string
  grade: number | null
  feedback: string | null
  graded_at: string | null
}
