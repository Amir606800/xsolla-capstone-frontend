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

export interface Submission {
  submittedAt: string // ISO
  textBody?: string
  files?: SubmissionFile[]
  /** Set when the work was graded and given feedback. A graded submission can no longer be changed. */
  feedback?: string
  gradedAt?: string // ISO
}

interface BaseItem {
  id: string
  moduleId: string
  title: string
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

export interface AssignmentItem extends BaseItem {
  type: 'assignment'
  description?: string
  /** What the student has to hand in. */
  requirements?: string[]
  dueAt: string // ISO
  submission?: Submission
}

/** One multiple-choice question. `correct` is the index of the right option. */
export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  /** Only ever sent to lecturers: the backend must strip it from what students receive. */
  correct?: number
}

/**
 * A short multiple-choice quiz written by the lecturer (optional; AI-generated quizzes may come later).
 * Taking a quiz is not built yet: students only see that it exists.
 */
export interface QuizItem extends BaseItem {
  type: 'quiz'
  description?: string
  dueAt?: string // ISO
  questions?: QuizQuestion[]
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
  items: ContentItem[]
}
