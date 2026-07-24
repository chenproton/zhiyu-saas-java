export interface Scenario {
  id: string
  name: string
  code: string
  coverImage?: string
  careerPositionId?: string
  industryIds?: string[]
  industryNames?: string[]
  professionIds?: string[]
  professionNames?: string[]
  batchId?: string
  difficulty: number
  version: string
  viewCount?: number
  status: "draft" | "pending" | "approved" | "rejected" | "published" | "archived"
  background?: string
  deliveryGoal?: string
  creatorId: string
  coBuilderIds: string[]
  createdAt: string
  updatedAt: string
  publishTime?: string
}

export interface ScenarioTask {
  id: string
  scenarioId: string
  name: string
  code: string
  sortOrder: number
  description?: string
  detailedDescription?: string
  descriptionPdf?: string
  estimatedHours: number
  taskType: "assessment" | "training"
  difficulty: number
  background?: string
  dependencyIds: string[]
  isReferenced: boolean
  sourceScenarioId?: string
  knowledgePointIds: string[]
  abilityPointIds: string[]
  resourceIds: string[]
  evalData?: Record<string, any>
}

export interface TaskDeliverable {
  id: string
  taskId: string
  type: string
  name: string
  description?: string
  evaluationPoints?: Record<string, any>
  sortOrder: number
}

export interface TaskResource {
  id: string
  name: string
  type: string
  url?: string
  description?: string
  thumbnail?: string
  size?: string
  knowledgePointIds?: string[]
  extraData?: Record<string, any>
  uploadedBy?: string
  uploadedAt: string
}

export interface TaskResourceBinding {
  id: string
  taskId: string
  resourceId: string
}

export interface TaskKnowledgeBinding {
  id: string
  taskId: string
  knowledgePointId: string
}

export interface TaskAbilityBinding {
  id: string
  taskId: string
  abilityPointId: string
}

export interface RubricTemplate {
  id: string
  tenantId: string
  name: string
  mode: "rubric" | "score_rule"
  types?: string[]
  description?: string
  data: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface TaskEvaluationMethod {
  id: string
  taskId: string
  methodKey: string
  weight: number
  evalObject: string
  scoreType?: string
  evalSubjects: Record<string, any>[]
  rubricTemplateId?: string
  resourceConfig: Record<string, any>
  evalPoints: TaskEvalPoint[]
  reviewSteps: TaskReviewStep[]
}

export interface TaskEvalPoint {
  id: string
  configId: string
  name: string
  description?: string
  subType?: string
  types?: string[]
  weight: number
  scoringMethod: string
  gradeMapping?: Record<string, any>[]
  knowledgePointIds?: string[]
  abilityPointIds?: string[]
  sortOrder: number
}

export interface TaskReviewStep {
  id: string
  configId: string
  label: string
  description?: string
  enabled: boolean
  subjectType?: string
  weight: number
  sortOrder: number
}

export interface ScenarioWeightConfig {
  id: string
  scenarioId: string
  taskId: string
  weight: number
}

export interface ScenarioGradeMapping {
  id: string
  scenarioId: string
  taskId?: string
  level: string
  minScore: number
  maxScore: number
  description?: string
  color?: string
}

export interface SceneArchive {
  id: string
  scenarioId: string
  version: string
  snapshotData: Record<string, any>
  archivedAt: string
}

export interface SceneBatch {
  id: string
  tenantId?: string
  name: string
  code?: string
  orgNodeId?: string
  majorId?: string
  majorName?: string // Deprecated
  workflowId?: string
  status: "open" | "closed"
  scenarioCount?: number
  createdAt: string
  updatedAt: string
}
