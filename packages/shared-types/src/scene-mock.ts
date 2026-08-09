/**
 * @deprecated This file contains component-local mock data types that conflict
 * with the canonical types in `scene.ts`. The canonical `Scenario` type in
 * scene.ts has different fields (careerPositionId, industryIds, batchId, etc.)
 * and should be used for all new code.
 *
 * Component-local type shapes originally from `lib/scene-mock-data`（并吸收
 * 了 apps/edu/lib/mock-data 中任务编辑器使用的 Task/GradeMapping/PositionAbility 等类型）。
 * These types are used by scene builder / simulation UI components and do
 * not necessarily match the backend API schema in `lib/types/scene.ts`.
 * When adding new code, import from `scene.ts` instead.
 */

export interface Profession {
  id: string
  name: string
  positions: Position[]
}

export interface Position {
  id: string
  name: string
  professionId: string
}

export interface Scenario {
  id: string
  name: string
  code: string
  coverImage: string
  positionId?: string
  positionName?: string
  professionId?: string
  professionName?: string
  industryId?: string
  industryName?: string
  batchId?: string
  batchName?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  version: string
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published'
  background: string
  deliveryGoal: string
  creatorId: string
  creatorName: string
  coBuilders: { id: string; name: string }[]
  tasks: Task[]
  weightConfig: WeightConfig
  gradeMapping: GradeMapping[]
  createdAt: string
  updatedAt: string
  publishTime?: string
  relatedScenesCount?: number
}

export interface TaskEvalPoint {
  id: string
  name: string
  desc: string
  weight: number
  maxScore: number
  scoringMethod?: 'score' | 'level' | 'rubric'
  gradeMapping?: GradeMapping[]
  subType?: string
  types?: string[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
}

export interface ReviewStep {
  id: string
  label: string
  desc: string
  enabled: boolean
  subjectType: string | null
}

export interface Task {
  id: string
  name: string
  code: string
  order: number
  description: string
  detailedDescription?: string
  descriptionPdf?: string
  estimatedHours: number
  taskType: 'assessment' | 'training'
  difficulty: 1 | 2 | 3 | 4 | 5
  background: string
  dependencies: string[]
  resources: string[]
  deliverables: TaskDeliverable[]
  knowledgePoints: string[]
  /** 与 knowledgePoints 按序对齐的知识点名称（服务端返回，弹窗/卡片预览直接使用，不依赖全量知识点列表） */
  knowledgePointNames?: string[]
  abilityPoints: string[]
  /** 与 abilityPoints 按序对齐的能力点名称（服务端返回，卡片预览直接使用，不依赖全量能力点列表） */
  abilityPointNames?: string[]
  assessment: Assessment | null
  isReferenced?: boolean
  sourceScenarioId?: string
  sourceScenarioName?: string
  evalData?: Record<string, any>
  evalPoints?: {
    randomDraw?: TaskEvalPoint[]
    review?: TaskEvalPoint[]
    paper?: TaskEvalPoint[]
    questionBank?: TaskEvalPoint[]
    outcome?: TaskEvalPoint[]
    homework?: TaskEvalPoint[]
    quiz?: TaskEvalPoint[]
  }
  reviewSteps?: ReviewStep[]
}

export interface TaskDeliverable {
  id: string
  type: 'exercise' | 'onsite_evaluation' | 'result_file'
  name: string
  description: string
  evaluationPoints?: EvaluationPoint[]
}

export interface EvaluationPoint {
  id: string
  name: string
  description: string
  maxLevel: 5
}

export interface Resource {
  id: string
  name: string
  type: 'document' | 'video' | 'link' | 'file'
  url: string
  size?: string
}

export interface DeliverableType {
  id: string
  name: string
  type: 'report' | 'code' | 'video' | 'presentation' | 'document' | 'other'
  required: boolean
  description: string
}

export interface Assessment {
  type: 'objective' | 'subjective' | 'mixed'
  objectiveConfig?: ObjectiveConfig
  subjectiveConfig?: SubjectiveConfig
  mixedWeights?: { objective: number; subjective: number }
}

export interface ObjectiveConfig {
  totalScore: number
  questions: QuestionItem[]
  randomDraw?: {
    enabled: boolean
    count: number
    fromPool: string
  }
}

export interface QuestionItem {
  id: string
  type: 'single' | 'multiple' | 'judgment'
  content: string
  options?: string[]
  answer: string | string[]
  score: number
}

export interface SubjectiveConfig {
  totalScore: number
  rubricPoints: RubricPoint[]
  synthesisRule: 'sum' | 'weighted'
}

export interface RubricPoint {
  id: string
  name: string
  weight: number
  maxScore: number
  levels: RubricLevel[]
}

export interface RubricLevel {
  id: string
  name: string
  minScore: number
  maxScore: number
  description: string
  color: string
}

export interface WeightConfig {
  tasks: { taskId: string; weight: number }[]
}

export interface GradeMapping {
  id: string
  grade: string
  minScore: number
  maxScore: number
  color: string
  remark?: string
}

// 岗位能力（迁自 apps/edu/lib/mock-data，任务编辑器使用）
export interface PositionAbility {
  id: string
  positionId: string
  name: string
  description: string
  weight: number // 在岗位内的权重占比（0-100）
  category: string
}

export interface ObjectiveSubmissionAnswer {
  questionId: string
  questionName?: string
  questionType: 'single' | 'multiple' | 'judgment' | 'text'
  questionContent: string
  options?: string[]
  correctAnswer: string | string[]
  studentAnswer: string | string[]
  score: number
  maxScore: number
  isCorrect: boolean
}

export interface SubmissionAttachment {
  id: string
  name: string
  type: 'document' | 'code' | 'video' | 'image' | 'other'
  url: string
  content?: string // 预览内容（Mock 数据使用）
}
