/**
 * Course content model. One course has 12 modules (= weeks); each module has
 * content items. Mirrors the backend `content_items` tree (module = top-level
 * section). Shapes will be refined when the real API lands.
 */

export interface Submission {
  submittedAt: string // ISO
  grade?: number
  feedback?: string
  gradedAt?: string // ISO
}

interface BaseItem {
  id: string
  moduleId: string
  title: string
}

export interface ResourceItem extends BaseItem {
  type: 'resource'
  kind: 'pdf' | 'pptx' | 'md' | 'zip' | 'link'
}

export interface AssignmentItem extends BaseItem {
  type: 'assignment'
  dueAt: string // ISO
  maxPoints: number
  submission?: Submission
}

/** Placeholder: quizzes are not designed yet, the slot is reserved in the UI. */
export interface QuizItem extends BaseItem {
  type: 'quiz'
}

export type ContentItem = ResourceItem | AssignmentItem | QuizItem

export interface CourseModule {
  id: string
  position: number // 1..12
  title: string
  items: ContentItem[]
}
