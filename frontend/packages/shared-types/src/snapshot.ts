// ==================== 资源快照 bundle（GET /{base}/{id}/snapshot）====================
//
// 响应为 resource_snapshots.snapshot_data 的 jsonb 原文：按表名分 key（snake_case），
// 行内字段名 = 数据库列名。jsonb schema 见 backend/internal/store/snapshot_builders.go 文件头注释。
// 学生角色响应中答案/解析字段已被服务端剥离（StripStudentAnswers），故 answer/analysis 均为可选。

/** 连带冻结的知识点内容 */
export interface SnapshotKnowledgePoint {
  id: string
  name: string
  code?: string
  description?: string
  category?: string
}

/** 连带冻结的能力点内容 */
export interface SnapshotAbilityPoint {
  id: string
  name: string
  code?: string
  description?: string
  attributes?: Record<string, any>
}

/** 连带冻结的资源库条目内容 */
export interface SnapshotResourceItem {
  id: string
  name: string
  resource_type?: string
  url?: string
  description?: string
  thumbnail?: string
  file_size?: number
  metadata?: Record<string, any>
}

// ---------- 场景快照（/scene/scenarios/{id}/snapshot） ----------

export interface ScenarioSnapshotScenario {
  id: string
  name: string
  code?: string
  cover_image?: string
  career_position_id?: string
  industry_ids?: string[]
  profession_ids?: string[]
  batch_id?: string
  difficulty?: string
  version?: string
  background?: string
  delivery_goal?: string
  co_builder_ids?: string[]
}

export interface ScenarioSnapshotTask {
  id: string
  scenario_id: string
  name: string
  code?: string
  sort_order?: number
  description?: string
  detailed_description?: string
  description_pdf?: string
  estimated_hours?: number
  task_type?: string
  difficulty?: string
  background?: string
  dependency_ids?: string[]
  is_referenced?: boolean
  source_scenario_id?: string
  knowledge_point_ids?: string[]
  ability_point_ids?: string[]
  resource_ids?: string[]
  eval_data?: Record<string, any>
  tenant_id?: string
}

export interface ScenarioSnapshotEvalMethod {
  id: string
  task_id: string
  method_key: string
  weight?: number
  eval_object?: string
  score_type?: string
  eval_subjects?: Record<string, any>
  standard_name?: string
  standard_mode?: string
  resource_config?: Record<string, any>
  /** 乐观锁版本号（整数），与资源版本字符串不同义 */
  version?: number
  is_enabled?: boolean
}

export interface ScenarioSnapshotEvalPoint {
  id: string
  config_id: string
  name: string
  description?: string
  sub_type?: string
  types?: string[]
  weight?: number
  scoring_method?: string
  grade_mapping?: Record<string, any>
  knowledge_point_ids?: string[]
  ability_point_ids?: string[]
  sort_order?: number
}

export interface ScenarioSnapshotScoreRule {
  id: string
  config_id: string
  name: string
  description?: string
  rule?: Record<string, any>
  weight?: number
  sort_order?: number
}

export interface ScenarioSnapshotReviewStep {
  id: string
  config_id: string
  label: string
  description?: string
  enabled?: boolean
  subject_type?: string
  weight?: number
  sort_order?: number
}

export interface ScenarioSnapshotDeliverable {
  id: string
  task_id: string
  type?: string
  name: string
  description?: string
  evaluation_points?: Record<string, any>
  sort_order?: number
}

export interface ScenarioSnapshotResourceBinding {
  id: string
  task_id: string
  resource_id: string
}

export interface ScenarioSnapshotKnowledgeBinding {
  id: string
  task_id: string
  knowledge_point_id: string
}

export interface ScenarioSnapshotAbilityBinding {
  id: string
  task_id: string
  ability_point_id: string
}

export interface ScenarioSnapshotWeightConfig {
  id: string
  task_id: string
  weight: number
}

export interface ScenarioSnapshotGradeMapping {
  id: string
  task_id: string
  level: string
  min_score?: number
  max_score?: number
  description?: string
  color?: string
}

/** 随机抽题内容（answer 学生侧被剥离） */
export interface ScenarioSnapshotRandomDrawQuestion {
  id: string
  name: string
  description?: string
  answer?: string
}

export interface ScenarioSnapshot {
  scenario: ScenarioSnapshotScenario
  scenario_tasks: ScenarioSnapshotTask[]
  task_evaluation_methods: ScenarioSnapshotEvalMethod[]
  task_eval_points: ScenarioSnapshotEvalPoint[]
  task_eval_score_rules: ScenarioSnapshotScoreRule[]
  task_review_steps: ScenarioSnapshotReviewStep[]
  task_deliverables: ScenarioSnapshotDeliverable[]
  task_resource_bindings: ScenarioSnapshotResourceBinding[]
  task_knowledge_bindings: ScenarioSnapshotKnowledgeBinding[]
  task_ability_bindings: ScenarioSnapshotAbilityBinding[]
  scenario_weight_configs: ScenarioSnapshotWeightConfig[]
  scenario_grade_mappings: ScenarioSnapshotGradeMapping[]
  knowledge_points: SnapshotKnowledgePoint[]
  ability_points: SnapshotAbilityPoint[]
  resource_library: SnapshotResourceItem[]
  random_draw_questions: ScenarioSnapshotRandomDrawQuestion[]
  /** 关联岗位全树（可空），结构同 PositionSnapshot */
  position?: PositionSnapshot
}

// ---------- 课程快照（/lesson/courses/{id}/snapshot） ----------

export interface CourseSnapshotCourse {
  id: string
  tenant_id?: string
  code?: string
  name: string
  type?: string
  category?: string
  major_id?: string
  teacher_id?: string
  industry_id?: string
  version?: string
  online_hours?: number
  offline_hours?: number
  online_weight?: number
  offline_weight?: number
  semester?: string
  class_name?: string
  status?: string
  cover_color?: string
  cover_image?: string
  course_tag?: string
  difficulty?: string
  description?: string
  creator_id?: string
  co_creator_ids?: string[]
  batch_id?: string
  knowledge_point_ids?: string[]
  ability_point_ids?: string[]
  resource_ids?: string[]
  eval_data?: Record<string, any>
  node_count?: number
  resource_count?: number
  study_count?: number
}

export interface CourseSnapshotNode {
  id: string
  tenant_id?: string
  course_id: string
  parent_id?: string
  name: string
  code?: string
  sort_order?: number
  ref_type?: string
  source_id?: string
  source_name?: string
  teaching_goals?: string
  detailed_description?: string
  description_pdf?: string
  background?: string
  estimated_hours?: number
  duration?: number
  difficulty?: string
  knowledge_point_ids?: string[]
  resource_ids?: string[]
  ability_point_ids?: string[]
  /** lesson 系测评配置内联于此（快照必含，防测评标准漂移） */
  eval_data?: Record<string, any>
  status?: string
}

export interface CourseSnapshotQuiz {
  id: string
  node_id: string
  title: string
  type?: string
  time_limit?: number
}

/** 节点测验题目（answer 学生侧被剥离） */
export interface CourseSnapshotQuizQuestion {
  id: string
  quiz_id: string
  type?: string
  question: string
  options?: string[]
  answer?: string
  score?: number
  sort_order?: number
}

export interface CourseSnapshotHybridModule {
  id: string
  node_id: string
  module_key: string
  mode?: string
  data?: Record<string, any>
}

/** 课程核心内容（主表+节点+节点测验+混合模块），颗粒课一层同构复用 */
export interface CourseSnapshotCore {
  course: CourseSnapshotCourse
  system_course_nodes: CourseSnapshotNode[]
  node_quizzes: CourseSnapshotQuiz[]
  node_quiz_questions: CourseSnapshotQuizQuestion[]
  hybrid_node_modules: CourseSnapshotHybridModule[]
}

export interface CourseSnapshotKnowledgeBinding {
  id: string
  course_id: string
  knowledge_point_id: string
  bind_type?: string
  source_id?: string
}

export interface CourseSnapshotResourceBinding {
  id: string
  course_id: string
  resource_id: string
}

export interface CourseSnapshotNodeKnowledgeBinding {
  id: string
  node_id: string
  knowledge_point_id: string
}

export interface CourseSnapshotNodeResourceBinding {
  id: string
  node_id: string
  resource_id: string
}

export interface CourseSnapshot extends CourseSnapshotCore {
  course_knowledge_bindings: CourseSnapshotKnowledgeBinding[]
  course_resource_bindings: CourseSnapshotResourceBinding[]
  node_knowledge_point_bindings: CourseSnapshotNodeKnowledgeBinding[]
  node_resource_bindings: CourseSnapshotNodeResourceBinding[]
  knowledge_points: SnapshotKnowledgePoint[]
  resource_library: SnapshotResourceItem[]
  /** 节点 ref_type='original' 引用的颗粒课一层（source_id → 核心 bundle，不递归） */
  granular_courses: Record<string, CourseSnapshotCore>
}

// ---------- 试卷快照（/evaluation/exams/{id}/snapshot） ----------

export interface ExamSnapshotExam {
  id: string
  code?: string
  name: string
  description?: string
  status?: string
  total_score?: number
  duration?: number
  cover_image?: string
  is_temp?: boolean
  collaborator_ids?: string[]
  collaborator_dept_ids?: string[]
  batch_id?: string
  version?: string
  owner_type?: string
}

/** 试卷题目内容副本（answer/analysis 学生侧被剥离；question_id 删题后置 NULL） */
export interface ExamSnapshotQuestion {
  id: string
  exam_id: string
  question_id?: string
  type?: string
  content: string
  options?: string[]
  answer?: string | string[]
  analysis?: string
  score?: number
  sort_order?: number
}

export interface ExamSnapshot {
  exam: ExamSnapshotExam
  exam_questions: ExamSnapshotQuestion[]
}

// ---------- 题库快照（/evaluation/question-banks/{id}/snapshot） ----------

export interface QuestionBankSnapshotBank {
  id: string
  code?: string
  name: string
  description?: string
  cover_image?: string
  status?: string
  question_count?: number
  collaborator_ids?: string[]
  collaborator_dept_ids?: string[]
  batch_id?: string
  version?: string
  owner_type?: string
  is_draft_pool?: boolean
}

/** 已发布题目（answer/analysis 学生侧被剥离） */
export interface QuestionBankSnapshotQuestion {
  id: string
  code?: string
  bank_id: string
  type?: string
  content: string
  options?: string[]
  answer?: string | string[]
  analysis?: string
  score?: number
  difficulty?: string
  knowledge_point_ids?: string[]
  source?: string
  status?: string
  created_at?: string
}

export interface QuestionBankSnapshot {
  question_bank: QuestionBankSnapshotBank
  questions: QuestionBankSnapshotQuestion[]
}

// ---------- 岗位快照（/job/positions/{id}/snapshot） ----------

export interface PositionSnapshotPosition {
  id: string
  tenant_id?: string
  code?: string
  batch_id?: string
  name: string
  short_name?: string
  industry_id?: string
  position_type?: string
  salary_min?: number
  salary_max?: number
  cover_image?: string
  description?: string
  requirements?: string
  career_path?: string
  version?: string
  status?: string
  created_by?: string
  collaborators?: string[]
}

export interface PositionSnapshotMajor {
  id: string
  career_position_id: string
  major_id: string
}

export interface PositionSnapshotResponsibility {
  id: string
  career_position_id: string
  name: string
  description?: string
  sort_order?: number
}

export interface PositionSnapshotAbilityBinding {
  id: string
  career_position_id: string
  responsibility_id?: string
  ability_point_id?: string
  source?: string
  domain?: string
  required_level?: string
  rubric_description?: string
  attributes?: Record<string, any>
  weight?: number
}

export interface PositionSnapshotAbilityDomain {
  id: string
  career_position_id: string
  name: string
  description?: string
  binding_ids?: string[]
  sort_order?: number
}

export interface PositionSnapshotCertificate {
  id: string
  career_position_id: string
  certificate_library_id: string
}

export interface PositionSnapshotCertificationRule {
  id: string
  career_position_id: string
  status?: string
  rule_source?: string
  level_mapping?: Record<string, any>[]
}

export interface PositionSnapshotCertificationWeight {
  id: string
  rule_id: string
  ability_point_id?: string
  task_id?: string
  weight?: number
}

export interface PositionSnapshotCertificationItem {
  id: string
  rule_id: string
  name: string
  sort_order?: number
}

export interface PositionSnapshotCertificationPoint {
  id: string
  item_id: string
  ability_point_id?: string
  mapping_type?: string
  custom_level_mapping?: Record<string, any>[]
  required_level?: string
  weight?: number
}

export interface PositionSnapshot {
  position: PositionSnapshotPosition
  career_position_majors: PositionSnapshotMajor[]
  position_responsibilities: PositionSnapshotResponsibility[]
  position_ability_bindings: PositionSnapshotAbilityBinding[]
  ability_domains: PositionSnapshotAbilityDomain[]
  position_certificates: PositionSnapshotCertificate[]
  certification_rules: PositionSnapshotCertificationRule[]
  certification_weights: PositionSnapshotCertificationWeight[]
  certification_ability_items: PositionSnapshotCertificationItem[]
  certification_ability_points: PositionSnapshotCertificationPoint[]
  ability_points: SnapshotAbilityPoint[]
}
