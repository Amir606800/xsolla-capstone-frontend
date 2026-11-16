/**
 * Course content model. One course has 12 modules (= weeks); each module has
 * content items. Mirrors the backend `content_items` tree (module = top-level
 * section). Shapes will be refined when the real API lands.
 */

export interface SubmissionFile {
  name: string
  sizeBytes: number
  /** The backend's file id, used to download it. */
  id?: string
}

/** One handed-in version of a student's work. */
export interface SubmissionVersion {
  submittedAt: string // ISO
  textBody?: string
  files?: SubmissionFile[]
}

/**
 * The student's current work on a task. They may hand in a new version as often as they like, also after the
 * deadline; the versions before it stay in `history` (newest first) so nothing they sent is lost.
 */
export interface Submission extends SubmissionVersion {
  /** Handed in after the student's deadline: a "Late submission", and the week grade turns red. */
  late?: boolean
  /** Set when the work was graded and given feedback. A graded submission can no longer be changed. */
  feedback?: string
  gradedAt?: string // ISO
  /** Earlier versions, newest first. */
  history?: SubmissionVersion[]
}

interface BaseItem {
  id: string
  moduleId: string
  title: string
  /** Who wrote it (user id). The backend does not send it for items yet: the module's lecturer is shown instead. */
  createdBy?: number
  /** Hidden from students (backend `is_visible: false`). Only admins ever receive hidden items. */
  hidden?: boolean
}

/** Lecturer material: own slides/files or an external source. */
export interface ResourceItem extends BaseItem {
  type: 'resource'
  kind: 'pdf' | 'pptx' | 'md' | 'zip' | 'link'
  description?: string
  /** External link target (kind === 'link'). Files are downloaded through the API instead. */
  url?: string
  /** Uploaded file (name and size only in the mock; the real file goes through POST /files). */
  file?: SubmissionFile
  /** The backend's id of the uploaded file. */
  fileId?: string
  /** A newly chosen file, only while it is being saved (never stored). */
  upload?: File
}

/** Why a student's deadline is when it is: 08:00 on the day of their booked 1:1, or no 1:1 booked (Monday 08:00). */
export type DueFrom = 'one_on_one' | 'no_one_on_one'

export interface AssignmentItem extends BaseItem {
  type: 'assignment'
  description?: string
  /** What the student has to hand in. */
  requirements?: string[]
  /**
   * A task has no deadline of its own. For a student this is THEIR deadline: 08:00 on the day of their 1:1 that week, or
   * Monday 08:00 with no 1:1 booked (see utils/deadline). Staff get none; a week without an opening date has none.
   */
  dueAt?: string // ISO
  /** Why the student's deadline is when it is: their booked 1:1, or none booked yet. */
  dueFrom?: DueFrom
  submission?: Submission
}

/** One multiple-choice question. `correct` is the index of the right option. */
export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correct?: number
}

export interface QuizAttempt {
  id: string
  quizId: string
  answers: number[]
  score: number
  total: number
  submittedAt: string
}

export type QuizStatus = 'generating' | 'ready' | 'failed'

export interface QuizItem extends BaseItem {
  type: 'quiz'
  description?: string
  dueAt?: string
  status?: QuizStatus
  errorMessage?: string
  isAiGenerated?: boolean
  sourceContentItemId?: string
  questions?: QuizQuestion[]
  attempt?: QuizAttempt
}

export type ContentItem = ResourceItem | AssignmentItem | QuizItem

export interface CourseModule {
  id: string
  position: number // 1..12
  title: string
  description?: string
  /** When the module opens / closes (week range). Not in the backend schema yet. */
  opensAt?: string
  closesAt?: string
  /** The lecturers the week is assigned to (user ids): a week can have several, a lecturer can teach several weeks. */
  lecturerIds?: number[]
  /** The first of `lecturerIds` (kept for places that need "the" lecturer, e.g. who wrote an item), and when the module was made. */
  createdBy?: number
  createdAt?: string
  items: ContentItem[]
}
