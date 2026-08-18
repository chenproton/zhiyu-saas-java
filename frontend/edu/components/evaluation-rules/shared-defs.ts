export interface CachedQuestion {
  id: string
  name?: string
  content?: string
  type?: string
  difficulty?: string
  score?: number
  questionBank?: string
  [key: string]: unknown
}

export interface LoadedExam {
  id: string
  name: string
  questions?: unknown[]
  questionCount?: number
  totalScore?: number
}

export {
  QUESTION_TYPE_BADGE_CLASSES as typeColorMap,
  QUESTION_TYPE_LABELS_SHORT as questionTypeLabels,
  DIFFICULTY_LABELS as difficultyLabels,
} from '@zhiyu/shared-types'
