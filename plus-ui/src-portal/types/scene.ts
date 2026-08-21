import type { ContentStatus } from './content-status';

export interface Scenario {
  id: string;
  name: string;
  code?: string;
  coverImage?: string;
  careerPositionId?: string;
  industryIds?: string[];
  industryNames?: string[];
  professionIds?: string[];
  professionNames?: string[];
  batchId?: string;
  difficulty: number;
  version: string;
  viewCount?: number;
  status: ContentStatus;
  sourceType?: 'school' | 'enterprise';
  sourceEnterpriseId?: string;
  background?: string;
  deliveryGoal?: string;
  creatorId: string;
  creatorName?: string;
  coBuilderIds?: string[];
  createdAt: string;
  updatedAt: string;
  publishTime?: string;
  taskCount?: number;
}

export interface ScenarioTask {
  id: string;
  scenarioId: string;
  name: string;
  code: string;
  sortOrder: number;
  description?: string;
  detailedDescription?: string;
  descriptionPdf?: string;
  estimatedHours: number;
  taskType: 'assessment' | 'training';
  difficulty: number;
  background?: string;
  dependencyIds?: string[];
  isReferenced: boolean;
  sourceScenarioId?: string;
  knowledgePointIds?: string[];
  knowledgePointNames?: string[];
  abilityPointIds?: string[];
  abilityPointNames?: string[];
  resourceIds?: string[];
  evalData?: Record<string, unknown>;
}

// 场景任务资源（上传/引用的文档、附件等），对齐 React shared-types scene.ts TaskResource
export interface TaskResource {
  id: string;
  name: string;
  type: string;
  url?: string;
  description?: string;
  thumbnail?: string;
  size?: string;
  knowledgePointIds?: string[];
  extraData?: Record<string, unknown>;
  uploadedBy?: string;
  uploadedAt: string;
}

// 任务资源绑定（task-resources），对齐 React shared-types scene.ts TaskResourceBinding
export interface TaskResourceBinding {
  id: string;
  taskId: string;
  resourceId: string;
}

// ==================== 任务评价方式（对齐 React shared-types scene.ts） ====================

export interface TaskEvalPoint {
  id: string;
  configId: string;
  name: string;
  description?: string;
  subType?: string;
  types?: string[];
  weight: number;
  scoringMethod: string;
  gradeMapping?: Record<string, unknown>[];
  knowledgePointIds?: string[];
  abilityPointIds?: string[];
  sortOrder: number;
}

export interface TaskScoreRule {
  id: string;
  configId: string;
  name: string;
  description?: string;
  rule?: string;
  weight: number;
  sortOrder: number;
}

export interface TaskReviewStep {
  id: string;
  configId: string;
  label: string;
  description?: string;
  enabled: boolean;
  subjectType?: string;
  assignedUserIds?: string[];
  weight: number;
  sortOrder: number;
}

export interface TaskEvaluationMethod {
  id: string;
  taskId: string;
  methodKey: string;
  weight: number;
  evalObject: string;
  scoreType?: string;
  evalSubjects: Record<string, unknown>[];
  rubricTemplateId?: string;
  standardName?: string;
  standardMode?: 'rubric' | 'score_rule';
  resourceConfig: Record<string, any>;
  version: number;
  isEnabled: boolean;
  evalPoints: TaskEvalPoint[];
  scoreRules?: TaskScoreRule[];
  reviewSteps: TaskReviewStep[];
}

// ==================== 场景快照 bundle（GET /scene/scenarios/{id}/snapshot） ====================
// 响应为 snapshot_data jsonb 原文：按表名分 key（snake_case），对齐 React shared-types snapshot.ts。
// 此处仅收录评分详情页消费的字段子集。

export interface ScenarioSnapshotScenario {
  id: string;
  name: string;
  code?: string;
  version?: string;
}

export interface ScenarioSnapshotTask {
  id: string;
  scenario_id: string;
  name: string;
}

export interface ScenarioSnapshotEvalMethod {
  id: string;
  task_id: string;
  method_key: string;
  weight?: number;
  eval_object?: string;
  score_type?: string;
  eval_subjects?: Record<string, any>;
  standard_name?: string;
  standard_mode?: string;
  resource_config?: Record<string, any>;
  /** 乐观锁版本号（整数），与资源版本字符串不同义 */
  version?: number;
  is_enabled?: boolean;
}

export interface ScenarioSnapshotEvalPoint {
  id: string;
  config_id: string;
  name: string;
  description?: string;
  sub_type?: string;
  types?: string[];
  weight?: number;
  scoring_method?: string;
  grade_mapping?: Record<string, any>;
  knowledge_point_ids?: string[];
  ability_point_ids?: string[];
  sort_order?: number;
}

export interface ScenarioSnapshotScoreRule {
  id: string;
  config_id: string;
  name: string;
  description?: string;
  rule?: Record<string, any> | string;
  weight?: number;
  sort_order?: number;
}

export interface ScenarioSnapshotReviewStep {
  id: string;
  config_id: string;
  label: string;
  description?: string;
  enabled?: boolean;
  subject_type?: string;
  weight?: number;
  sort_order?: number;
}

/** 随机抽题内容（answer 学生侧被剥离） */
export interface ScenarioSnapshotRandomDrawQuestion {
  id: string;
  name: string;
  description?: string;
  answer?: string;
}

export interface ScenarioSnapshot {
  scenario: ScenarioSnapshotScenario;
  scenario_tasks: ScenarioSnapshotTask[];
  task_evaluation_methods: ScenarioSnapshotEvalMethod[];
  task_eval_points: ScenarioSnapshotEvalPoint[];
  task_eval_score_rules: ScenarioSnapshotScoreRule[];
  task_review_steps: ScenarioSnapshotReviewStep[];
  random_draw_questions: ScenarioSnapshotRandomDrawQuestion[];
}
