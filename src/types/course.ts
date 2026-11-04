/**
 * Course content model. One course has 12 modules (= weeks); each module has
 * content items. Mirrors the backend `content_items` tree (module = top-level
 * section). Shapes will be refined when the real API lands.
 */

export interface SubmissionFile {
  name: string
  sizeBytes: number
}

export interface Submission {
  submittedAt: string // ISO
  textBody?: string
  files?: SubmissionFile[]
  grade?: number
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
}

export interface AssignmentItem extends BaseItem {
  type: 'assignment'
  description?: string
  /** What the student has to hand in. */
  requirements?: string[]
  dueAt: string // ISO
  maxPoints: number
  submission?: Submission
}

/** Placeholder: quizzes (AI-generated, later) are not designed yet; the slot is reserved in the UI. */
export interface QuizItem extends BaseItem {
  type: 'quiz'
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
