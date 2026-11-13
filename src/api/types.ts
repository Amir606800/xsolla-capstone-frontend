/**
 * Wire formats of the Go backend (github.com/Mahammadali12/xsolla-capstone-backend, internal/dto).
 * Only this file and ./mappers know them; the rest of the app uses the domain types in src/types.
 *
 * The backend's "module" is one week of the program (it used to be called "course"). Its content
 * items are a FLAT list of files, assignments and links; sections were removed.
 */

/** int64 ids arrive as JSON numbers; strings are accepted too (API_CONTRACT.md writes them as strings). */
export type ApiId = number | string

/** GET /modules, GET /modules/:id (dto.ModuleResponse). No position yet. */
export interface ApiModule {
  id: ApiId
  title: string
  description?: string | null
  created_by?: ApiId
  created_at: string
  /** Proposed (BACKEND_REQUIREMENTS.md 3.2): the week's dates. The server does not store them yet. */
  opens_at?: string | null
  closes_at?: string | null
}

interface ApiContentItemBase {
  id: ApiId
  title: string
  description?: string | null
  position: number
  is_visible: boolean
  file_id?: ApiId | null
  /** Always empty now that sections are gone; read defensively in case a parent ever comes back. */
  children?: ApiContentItem[]
}

export interface ApiFileItem extends ApiContentItemBase {
  type: 'file'
}

export interface ApiAssignmentItem extends ApiContentItemBase {
  type: 'assignment'
  /** Required by the backend when an assignment is created. */
  due_at?: string | null
  /** Not used: the program grades weeks, not tasks. Sent as 0. */
  max_points?: number
}

/** An outside page (dto.CreateContentItemRequest `url`). */
export interface ApiLinkItem extends ApiContentItemBase {
  type: 'link'
  url?: string | null
}

/** GET /modules/:moduleId/content-items (dto.ContentTreeNode) */
export type ApiContentItem = ApiFileItem | ApiAssignmentItem | ApiLinkItem

export interface ApiQuizQuestion {
  id: ApiId
  position: number
  prompt: string
  options: string[]
  correct?: number
}

export interface ApiQuizAttempt {
  id: ApiId
  quiz_id: ApiId
  student_id: ApiId
  answers: number[]
  score: number
  total: number
  submitted_at: string
}

export interface ApiQuiz {
  id: ApiId
  module_id: ApiId
  source_content_item_id?: ApiId | null
  title: string
  description?: string
  due_at?: string | null
  status: 'generating' | 'ready' | 'failed'
  error_message?: string
  is_ai_generated: boolean
  created_by: ApiId
  created_at: string
  questions: ApiQuizQuestion[]
  attempt?: ApiQuizAttempt | null
}

/** POST /files, GET /files/:id (dto.FileResponse) */
export interface ApiFile {
  id: ApiId
  original_name: string
  mime_type: string
  size_bytes: number
  created_at?: string
}

/** GET /modules/:moduleId/content-items/:assignmentId/submissions/me, POST .../submissions (dto.SubmissionResponse) */
export interface ApiSubmission {
  id: ApiId
  content_item_id: ApiId
  student_id?: ApiId
  text_body?: string | null
  submitted_at: string
  /** Not used: the program grades weeks, not tasks. */
  grade?: number | null
  feedback?: string | null
  graded_at?: string | null
  files?: ApiFile[] | null
  /** Proposed: the earlier attempts, newest first (on GET .../submissions/me). */
  history?: Omit<ApiSubmission, 'history'>[] | null
}

/** GET /events (dto.EventResponse) */
export interface ApiEvent {
  id: ApiId
  title: string
  kind: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location?: string | null
  description?: string | null
  /** Proposed: the online meeting link of a lecture or meeting. */
  meeting_url?: string | null
  module_id?: ApiId | null
  /** Set when the event was also created in the creator's Google Calendar. */
  google_event_id?: string | null
  created_at?: string
}

/** GET /standings/me (not in the backend yet): the mentor's grade of each finished week */
export interface ApiWeeklyStanding {
  /** Module position (1-12): a module is a week */
  week: number
  /** 'green' | 'yellow' | 'red' */
  level: string
  assessed_at: string
  note?: string | null
}
