// ==================== 测评方式与场景任务 ====================

// 一级测评分类
export interface EvaluationMethodCategory {
  id: string
  name: string
  order: number
}

// 二级测评方式
export interface EvaluationMethod {
  id: string
  categoryId: string
  name: string
  enabled: boolean
  relatedTaskIds: string[]
  description?: string
  docLink?: string
  subCategoryName?: string
}

// 场景任务
export interface SceneTask {
  id: string
  name: string
  sceneName: string
  methodIds: string[]
}

// 场景任务测评结果
export interface SceneEvaluationResult {
  id: string
  taskId: string
  sceneId?: string
  methodKey: string
  evaluateeId: string
  evaluatorId?: string
  evaluatorType?: string
  status: 'pending' | 'evaluated'
  totalScore?: number
  maxScore: number
  evalPointScores: Record<string, any>
  objectiveAnswers: Record<string, any>
  subjectiveContent: Record<string, any>
  drawnQuestions: Record<string, any>
  comment?: string
  gradedAt?: Date
  gradedBy?: string
  /** 提交时服务端盖章的场景资源版本（对应快照版本，如 V1.0） */
  version?: string
  createdAt?: Date
  updatedAt?: Date
}

// 岗位能力测评结果-能力点明细
export interface JobAbilityPointDetail {
  abilityPointId?: string
  abilityPointName: string
  score: number
  maxScore?: number
  weight?: number
  achieved: boolean
  requiredLevel?: string
  requiredLevelLabel?: string
  /** 能力点档位标签（自定义分档：未达标/了解L1/…/精通L5；默认：了解/理解/掌握/熟练/精通） */
  levelLabel?: string
  /** 能力点胜任度（新，%）：等级距离法，无效点无此字段 */
  competencyV2?: number
}

// 岗位能力测评结果
export interface JobAbilityResult {
  id: string
  positionId: string
  positionName: string
  userId?: string
  studentName: string
  studentId: string
  className?: string
  majorId?: string
  majorName?: string
  department?: string
  totalAbilityPoints: number
  achievedAbilityPoints: number
  achievementRate: number
  grade?: string
  /** 岗位胜任度（%）：能力点胜任度加权平均，负值归零 */
  positionCompetency?: number
  /** 岗位胜任度（新，%）：能力点胜任度（新）加权平均（等级距离法） */
  positionCompetencyV2?: number
  /** 能力认知得分（0-100）：能力点得分加权平均 */
  abilityCognitionScore?: number
  evaluationTime: string | Date
  abilityPointDetails?: JobAbilityPointDetail[]
  createdAt?: string
  updatedAt?: string
}

// 岗位能力认定结果汇总（按岗位分组）
export interface JobAbilitySummaryItem {
  positionId: string
  positionName: string
  studentCount: number
  avgRate: number
}

// 汇聚任务状态
export interface JobAbilityAggregateStatus {
  id?: string
  careerPositionId?: string
  status: string
  message?: string
  studentCount?: number
  updatedCount?: number
  errorMessage?: string
  startedAt?: string
  finishedAt?: string
}

// ==================== 场景任务评价相关（从 zhiyu-scene 迁移）====================

export interface SceneGradingStudent {
  id: string
  name: string
  studentNumber: string
  class: string
  department: string
  enrollmentYear: number
}

export interface SceneGradingSubmission {
  id: string
  studentId: string
  scenarioId: string
  scenarioName: string
  taskId: string
  taskName: string
  assessmentForm: string
  method: '试卷' | '题库' | '评审' | '现场问答'
  status: 'pending' | 'graded'
  submittedAt: string
  maxScore: number
}

export interface SceneGradingScenario {
  id: string
  name: string
  code: string
  positionName?: string
  tasks: {
    id: string
    name: string
    code: string
    taskType: 'assessment' | 'training'
    assessmentForm?: string
  }[]
}
