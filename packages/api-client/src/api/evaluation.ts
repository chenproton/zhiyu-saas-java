import type {
  QuestionBank,
  Question,
  Exam,
  ExamUsage,
  ExamResult,
  SceneEvaluationResult,
  JobAbilityResult,
  JobAbilitySummaryItem,
  JobAbilityAggregateStatus,
  CertificationRule,
  CertificationAbilityItem,
  CertificationAbilityPoint,
  CertificationRelatedTask,
  CustomLevelMapping,
  StudentAbilityPortrait,
  StudentAbilityArchive,
  GraduationProjectTopic,
  GraduationProjectArchive,
  GraduationProjectEvaluation,
  GraduationQueryResult,
  MicroCertTemplate,
  CertIssuanceRecord,
  AppealRecord,
  EvaluationBatch,
  EvaluationMethodCategory,
  EvaluationMethod,
  RandomDrawQuestion,
} from "../types/evaluation"
import { request, buildQuery, ListResponse } from "../api-helpers"
import { createCrudApi, createContentApi } from "../api-factory"

export const questionBankApi = createContentApi<QuestionBank, Omit<QuestionBank, "id" | "questionCount" | "createdAt" | "updatedAt">, Partial<Omit<QuestionBank, "id" | "questionCount" | "createdAt" | "updatedAt">>>("/evaluation/question-banks")

export const questionApi = {
  ...createCrudApi<Question, Omit<Question, "id" | "createdAt">, Partial<Omit<Question, "id" | "createdAt">>>("/evaluation/questions"),
  batchCreate: (bankId: string, items: Omit<Question, "id" | "bankId" | "createdAt">[]) =>
    request<{ count: number }>("/evaluation/questions/batch", { method: "POST", body: JSON.stringify({ bankId, items }) }),
}

export const randomDrawQuestionApi = createCrudApi<
  RandomDrawQuestion,
  Omit<RandomDrawQuestion, "id" | "createdAt" | "updatedAt">,
  Partial<Omit<RandomDrawQuestion, "id" | "createdAt" | "updatedAt">>
>("/evaluation/random-draw-questions")

export const examApi = {
  ...createContentApi<Exam, Omit<Exam, "id" | "totalScore" | "createdAt" | "updatedAt">, Partial<Omit<Exam, "id" | "totalScore" | "createdAt" | "updatedAt">>>("/evaluation/exams"),
  addQuestion: (id: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${id}/questions`, { method: "POST", body: JSON.stringify({ questionId, score }) }),
  removeQuestion: (id: string, questionId: string) =>
    request<Exam>(`/evaluation/exams/${id}/questions/${questionId}`, { method: "DELETE" }),
  updateQuestionScore: (examId: string, questionId: string, score: number) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/${questionId}`, { method: "PUT", body: JSON.stringify({ score }) }),
  updateQuestionScores: (examId: string, scores: Record<string, number>) =>
    request<Exam>(`/evaluation/exams/${examId}/questions/scores`, { method: "PUT", body: JSON.stringify(scores) }),
  publish: (id: string) => request<Exam>(`/evaluation/exams/${id}/publish`, { method: "POST" }),
}

export const examUsageApi = {
  list: (params?: { examId?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ExamUsage>>(`/evaluation/exam-usages${buildQuery(params || {})}`),
  get: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}`),
  create: (req: Omit<ExamUsage, "id" | "createdAt" | "updatedAt">) =>
    request<ExamUsage>("/evaluation/exam-usages", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<ExamUsage, "id" | "createdAt" | "updatedAt">>) =>
    request<ExamUsage>(`/evaluation/exam-usages/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/evaluation/exam-usages/${id}`, { method: "DELETE" }),
  start: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}/start`, { method: "POST" }),
  finish: (id: string) => request<ExamUsage>(`/evaluation/exam-usages/${id}/finish`, { method: "POST" }),
}

export const examResultApi = {
  list: (params?: { usageId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ExamResult>>(`/evaluation/exam-results${buildQuery(params || {})}`),
  submit: (req: { examUsageId: string; answers: Record<string, string | string[]>; methodKey?: string }) =>
    request<ExamResult>("/evaluation/exam-results", { method: "POST", body: JSON.stringify(req) }),
}

export const evaluationResultApi = {
  list: (params?: { taskId?: string; sceneId?: string; evaluateeId?: string; methodKey?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<SceneEvaluationResult>>(`/evaluation/results${buildQuery(params || {})}`),
  get: (id: string) => request<SceneEvaluationResult>(`/evaluation/results/${id}`),
  submit: (req: { taskId: string; sceneId?: string; methodKey: string; evaluateeId: string; maxScore?: number; objectiveAnswers?: Record<string, any>; subjectiveContent?: Record<string, any>; drawnQuestions?: Record<string, any>; evalPointScores?: Record<string, any> }) =>
    request<SceneEvaluationResult>("/evaluation/results", { method: "POST", body: JSON.stringify(req) }),
  grade: (id: string, req: { score: number; evalPointScores?: Record<string, any>; comment?: string; drawnQuestions?: Record<string, any>; objectiveAnswers?: Record<string, any>; subjectiveContent?: Record<string, any> }) =>
    request<SceneEvaluationResult>(`/evaluation/results/${id}/grade`, { method: "POST", body: JSON.stringify(req) }),
  batchGrade: (items: { id: string; score: number; evalPointScores?: Record<string, any>; comment?: string }[]) =>
    request<{ count: number }>("/evaluation/results/batch-grade", { method: "POST", body: JSON.stringify({ items }) }),
}

export const evaluationMethodApi = {
  listCategories: () => request<ListResponse<EvaluationMethodCategory>>("/evaluation/methods/categories"),
  listMethods: (params?: { categoryId?: string; enabled?: boolean }) =>
    request<ListResponse<EvaluationMethod>>(`/evaluation/methods${buildQuery(params || {})}`),
  toggle: (id: string, enabled: boolean) =>
    request<EvaluationMethod>(`/evaluation/methods/${id}/toggle`, { method: "POST", body: JSON.stringify({ enabled }) }),
}

export interface CertificationFullRuleItem {
  id: string
  name: string
  sortOrder: number
  abilityName?: string
  points: CertificationFullPoint[]
}

export interface CertificationFullPoint {
  id: string
  name: string
  description: string
  mappingType: string
  customLevelMapping?: CustomLevelMapping[]
  requiredLevel: string
  weight: number
  tasks?: CertificationRelatedTask[]
}

export interface CertificationFullRuleResponse {
  rule: CertificationRule
  items: CertificationFullRuleItem[]
}

// ==================== 全量写入 / 细粒度编辑请求体 ====================

export interface CertificationTaskPayload {
  taskId: string
  maxScore: number
  weight: number
}

export interface CertificationFullPointPayload {
  abilityPointId: string
  mappingType: string
  customLevelMapping?: CustomLevelMapping[]
  requiredLevel: string
  weight: number
  tasks: CertificationTaskPayload[]
}

export interface CertificationFullItemPayload {
  name: string
  sortOrder: number
  points: CertificationFullPointPayload[]
}

export interface CertificationFullRulePayload {
  careerPositionId: string
  ruleSource: string
  items: CertificationFullItemPayload[]
}

export interface CertificationPointPayload {
  abilityPointId: string
  mappingType: string
  customLevelMapping?: CustomLevelMapping[]
  requiredLevel: string
  weight: number
  /** 传入时整体替换该认证点下的关联任务 */
  tasks?: CertificationTaskPayload[]
}

export const certApi = {
  listRules: (params?: { careerPositionId?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertificationRule>>(`/evaluation/certifications${buildQuery(params || {})}`),
  getRule: (id: string) => request<CertificationRule>(`/evaluation/certifications/${id}`),
  createRule: (req: { careerPositionId: string; ruleSource: string }) =>
    request<CertificationRule>("/evaluation/certifications", { method: "POST", body: JSON.stringify(req) }),
  updateRule: (id: string, req: { careerPositionId: string; ruleSource: string }) =>
    request<CertificationRule>(`/evaluation/certifications/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteRule: (id: string) => request<{ id: string }>(`/evaluation/certifications/${id}`, { method: "DELETE" }),
  listItems: (ruleId: string) => request<ListResponse<CertificationAbilityItem>>(`/evaluation/certifications/${ruleId}/items`),
  upsertItem: (ruleId: string, req: Partial<CertificationAbilityItem>) =>
    request<CertificationAbilityItem>(`/evaluation/certifications/${ruleId}/items`, { method: "POST", body: JSON.stringify(req) }),
  updateItem: (id: string, req: { name: string; sortOrder: number }) =>
    request<CertificationAbilityItem>(`/evaluation/certifications/items/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteItem: (id: string) => request<{ id: string }>(`/evaluation/certifications/items/${id}`, { method: "DELETE" }),
  listPoints: (itemId: string) =>
    request<ListResponse<CertificationAbilityPoint>>(`/evaluation/certifications/items/${itemId}/points`),
  updatePoint: (id: string, req: CertificationPointPayload) =>
    request<CertificationAbilityPoint>(`/evaluation/certifications/points/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deletePoint: (id: string) => request<{ id: string }>(`/evaluation/certifications/points/${id}`, { method: "DELETE" }),
  createTask: (pointId: string, req: CertificationTaskPayload) =>
    request<CertificationRelatedTask>(`/evaluation/certifications/points/${pointId}/tasks`, { method: "POST", body: JSON.stringify(req) }),
  updateTask: (id: string, req: CertificationTaskPayload) =>
    request<CertificationRelatedTask>(`/evaluation/certifications/tasks/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteTask: (id: string) => request<{ id: string }>(`/evaluation/certifications/tasks/${id}`, { method: "DELETE" }),
  getFullRule: (id: string) => request<CertificationFullRuleResponse>(`/evaluation/certifications/${id}/full`),
  putFullRule: (id: string, req: CertificationFullRulePayload) =>
    request<CertificationRule>(`/evaluation/certifications/${id}/full`, { method: "PUT", body: JSON.stringify(req) }),
}

export interface LandingExamItem {
  id: string
  name: string
  status: string
  type: string
  time: string
  duration: number
  questionCount: number
  description: string
  college: string
  major: string
  targetAudience: string
}

export interface CompItem {
  name: string
  target: number
  current: number
  desc: string
}

export interface CompGroup {
  duty: string
  items: CompItem[]
}

export interface LeaderboardEntry {
  id: string
  studentName: string
  className: string
  major: string
  achievementRate: number
  grade: string
}

export interface CertGradeData {
  totalPoints: number
  avgRate: number
  lastUpdated: string
  compData: CompGroup[]
  leaderboard: LeaderboardEntry[]
}

export const landingApi = {
  listExams: (params?: { search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<LandingExamItem>>(`/evaluation/landing/exams${buildQuery(params || {})}`),
  getCertGrades: (positionId: string) =>
    request<{ grades: Record<string, CertGradeData> }>(`/evaluation/landing/certifications/${positionId}/grades`),
}

export const graduationApi = {
  listTopics: (params?: { careerPositionId?: string; status?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectTopic>>(`/evaluation/graduation/topics${buildQuery(params || {})}`),
  getTopic: (id: string) => request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}`),
  createTopic: (req: Omit<GraduationProjectTopic, "id" | "appliedCount" | "createdAt">) =>
    request<GraduationProjectTopic>("/evaluation/graduation/topics", { method: "POST", body: JSON.stringify(req) }),
  updateTopic: (id: string, req: Partial<Omit<GraduationProjectTopic, "id" | "appliedCount" | "createdAt">>) =>
    request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteTopic: (id: string) => request<{ id: string }>(`/evaluation/graduation/topics/${id}`, { method: "DELETE" }),
  applyTopic: (id: string) => request<GraduationProjectTopic>(`/evaluation/graduation/topics/${id}/apply`, { method: "POST" }),
  listArchives: (params?: { topicId?: string; userId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectArchive>>(`/evaluation/graduation/archives${buildQuery(params || {})}`),
  upsertArchive: (req: Partial<GraduationProjectArchive>) =>
    request<GraduationProjectArchive>("/evaluation/graduation/archives", { method: "POST", body: JSON.stringify(req) }),
  listEvaluations: (params?: { topicId?: string; userId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationProjectEvaluation>>(`/evaluation/graduation/evaluations${buildQuery(params || {})}`),
  upsertEvaluation: (req: Partial<GraduationProjectEvaluation>) =>
    request<GraduationProjectEvaluation>("/evaluation/graduation/evaluations", { method: "POST", body: JSON.stringify(req) }),
  queryResults: (params?: { userId?: string; className?: string; majorName?: string; limit?: number; offset?: number }) =>
    request<ListResponse<GraduationQueryResult>>(`/evaluation/graduation/query${buildQuery(params || {})}`),
}

export const jobAbilityResultApi = {
  list: (params?: { careerPositionId?: string; search?: string; grade?: string; page?: number; limit?: number }) =>
    request<ListResponse<JobAbilityResult>>(`/evaluation/job-ability/results${buildQuery(params || {})}`),
  get: (id: string) => request<JobAbilityResult>(`/evaluation/job-ability/results/${id}`),
  summary: () => request<JobAbilitySummaryItem[]>("/evaluation/job-ability/results/summary"),
  aggregate: (data: { careerPositionId: string; userIds?: string[] }) =>
    request<JobAbilityAggregateStatus>("/evaluation/job-ability/aggregate", { method: "POST", body: JSON.stringify(data) }),
  aggregateStatus: (careerPositionId?: string) =>
    request<JobAbilityAggregateStatus | null>(`/evaluation/job-ability/aggregate/status${buildQuery({ careerPositionId })}`),
}

export const portraitApi = {
  list: (params?: { userId?: string; careerPositionId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<StudentAbilityPortrait>>(`/evaluation/portraits${buildQuery(params || {})}`),
  get: (id: string) => request<StudentAbilityPortrait>(`/evaluation/portraits/${id}`),
  generate: (userId: string, careerPositionId: string) =>
    request<StudentAbilityPortrait>("/evaluation/portraits/generate", { method: "POST", body: JSON.stringify({ userId, careerPositionId }) }),
  listArchives: (params?: { userId?: string; materialType?: string; limit?: number; offset?: number }) =>
    request<ListResponse<StudentAbilityArchive>>(`/evaluation/portraits/archives${buildQuery(params || {})}`),
  upsertArchive: (req: Partial<StudentAbilityArchive>) =>
    request<StudentAbilityArchive>("/evaluation/portraits/archives", { method: "POST", body: JSON.stringify(req) }),
}

export const microCertApi = {
  listTemplates: (params?: { search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<MicroCertTemplate>>(`/evaluation/certificates/templates${buildQuery(params || {})}`),
  createTemplate: (req: Omit<MicroCertTemplate, "id" | "createdAt" | "updatedAt">) =>
    request<MicroCertTemplate>("/evaluation/certificates/templates", { method: "POST", body: JSON.stringify(req) }),
  updateTemplate: (id: string, req: Partial<Omit<MicroCertTemplate, "id" | "createdAt" | "updatedAt">>) =>
    request<MicroCertTemplate>(`/evaluation/certificates/templates/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  deleteTemplate: (id: string) => request<{ id: string }>(`/evaluation/certificates/templates/${id}`, { method: "DELETE" }),
  issue: (templateId: string, userIds: string[]) =>
    request<{ count: number }>("/evaluation/certificates/issue", { method: "POST", body: JSON.stringify({ templateId, userIds }) }),
  listHistory: (params?: { userId?: string; templateId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<CertIssuanceRecord>>(`/evaluation/certificates/history${buildQuery(params || {})}`),
}

export const appealApi = {
  list: (params?: { userId?: string; type?: string; status?: string; limit?: number; offset?: number }) =>
    request<ListResponse<AppealRecord>>(`/evaluation/appeals${buildQuery(params || {})}`),
  get: (id: string) => request<AppealRecord>(`/evaluation/appeals/${id}`),
  create: (req: Omit<AppealRecord, "id" | "status" | "createdAt">) =>
    request<AppealRecord>("/evaluation/appeals", { method: "POST", body: JSON.stringify(req) }),
  process: (id: string, req: { status: string; remark?: string }) =>
    request<AppealRecord>(`/evaluation/appeals/${id}/process`, { method: "POST", body: JSON.stringify(req) }),
}

export const evaluationBatchApi = {
  ...createCrudApi<EvaluationBatch, Omit<EvaluationBatch, "id" | "createdAt" | "updatedAt">, Partial<Omit<EvaluationBatch, "id" | "createdAt" | "updatedAt">>>("/evaluation/batches"),
  updateStatus: (id: string, status: string) =>
    request<EvaluationBatch>(`/evaluation/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}
