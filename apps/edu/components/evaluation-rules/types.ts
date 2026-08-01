import type { GradeMapping } from '@/lib/types/lesson'
import type {
  EvalRuleConfig,
  EvalRuleMethodKey,
  EvalRulePoint as EvalPoint,
  EvalRuleSubjectConfig,
  EvalRuleReviewStepInput,
} from '@/lib/types/evaluation'

export type EvalObjectType = 'individual' | 'group'

export type EvalSubType =
  | 'knowledge_mastery'
  | 'operation_standard'
  | 'task_completion'
  | 'result_quality'
  | 'communication'
  | 'collaboration'
  | 'professionalism'
  | 'innovation'
  | 'adaptability'

export interface ScoreRuleItem {
  id: string
  name: string
  desc: string
  rule: string
  weight: number
}

export interface RubricScheme {
  id: string
  name: string
  types: EvalSubType[]
  desc: string
  points: EvalPoint[]
  mode: 'rubric' | 'score_rule'
  scoreRuleItems?: ScoreRuleItem[]
  isDeleted?: boolean
}

export type EvalPointField =
  | 'randomDrawEvalPoints'
  | 'reviewEvalPoints'
  | 'paperEvalPoints'
  | 'questionBankEvalPoints'
  | 'outcomeEvalPoints'
  | 'homeworkEvalPoints'
  | 'quizEvalPoints'

export interface QuestionItem {
  id: string
  name: string
  type: string
  difficulty: string
  score: number
  questionBank: string
  source: string
  content: string
}

export type {
  EvalRuleConfig,
  EvalRuleMethodKey,
  EvalPoint,
  EvalRuleSubjectConfig,
  EvalRuleReviewStepInput,
  GradeMapping,
}
