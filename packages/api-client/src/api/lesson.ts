import type {
  Course,
  KnowledgePoint,
  SystemCourseNode as BackendSystemCourseNode,
  NodeHomework,
  NodeResource,
  LessonBatch,
  HybridNodeModule,
} from '../types/lesson'
import type { SystemCourseNode } from '../types/lesson-source'
import { request, buildQuery, ListResponse } from '../api-helpers'
import { createCrudApi, createContentApi } from '../api-factory'

export const courseApi = {
  ...createContentApi<
    Course,
    Omit<Course, 'id' | 'nodeCount' | 'resourceCount' | 'studyCount' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<Course, 'id' | 'createdAt' | 'updatedAt'>>
  >('/lesson/courses'),
  clone: (id: string, body: { name: string }) =>
    request<Course>(`/lesson/courses/${id}/clone`, { method: 'POST', body: JSON.stringify(body) }),
}

export interface CourseAssessmentExam {
  id: string
  examId: string
  examName: string
  isTemp: boolean
  name: string
  startTime?: string
  endTime?: string
  duration?: number
  status: string
  type: 'exam'
}

export interface CourseAssessmentHomework {
  id: string
  title: string
  requirement: string
  needAttachment: boolean
  deadline?: string
  status: string
  type: 'homework'
}

export interface CourseAssessmentsResponse {
  exams: CourseAssessmentExam[]
  homeworks: CourseAssessmentHomework[]
}

export const courseAssessmentsApi = {
  get: (courseId: string) =>
    request<CourseAssessmentsResponse>(`/lesson/courses/${courseId}/assessments`),
}

export interface CourseHomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  content?: string
  attachmentUrls?: string[]
  status: 'submitted' | 'graded'
  score?: number
  totalScore?: number
  comment?: string
  createdAt?: string
  gradedAt?: string
}

export const courseHomeworkApi = {
  submit: (
    courseId: string,
    homeworkId: string,
    req: { content?: string; attachmentUrls?: string[] },
  ) =>
    request<{ id: string; status: string }>(
      `/lesson/courses/${courseId}/homeworks/${homeworkId}/submit`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
  listSubmissions: (courseId: string, homeworkId: string) =>
    request<{ items: CourseHomeworkSubmission[] }>(
      `/lesson/courses/${courseId}/homeworks/${homeworkId}/submissions`,
    ),
  grade: (
    courseId: string,
    homeworkId: string,
    submissionId: string,
    req: { score: number; comment?: string },
  ) =>
    request<{ id: string; status: string }>(
      `/lesson/courses/${courseId}/homeworks/${homeworkId}/submissions/${submissionId}/grade`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
}

export const knowledgeApi = createCrudApi<
  KnowledgePoint,
  Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>,
  Partial<Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>>
>('/lesson/knowledge-points')

export const courseNodeApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<SystemCourseNode>>(`/lesson/nodes${buildQuery(params || {})}`),
  get: (id: string) => request<SystemCourseNode>(`/lesson/nodes/${id}`),
  create: (req: Omit<BackendSystemCourseNode, 'id' | 'createdAt' | 'updatedAt'>) =>
    request<SystemCourseNode>('/lesson/nodes', { method: 'POST', body: JSON.stringify(req) }),
  update: (
    id: string,
    req: Partial<Omit<BackendSystemCourseNode, 'id' | 'createdAt' | 'updatedAt'>>,
  ) =>
    request<SystemCourseNode>(`/lesson/nodes/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/lesson/nodes/${id}`, { method: 'DELETE' }),
  reorder: (courseId: string, nodeIds: string[]) =>
    request<{ ok: boolean }>('/lesson/nodes/reorder', {
      method: 'POST',
      body: JSON.stringify({ courseId, nodeIds }),
    }),
}

export const nodeResourceApi = {
  list: (params?: {
    courseId?: string
    nodeId?: string
    search?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<NodeResource>>(`/lesson/node-resources${buildQuery(params || {})}`),
  create: (req: Omit<NodeResource, 'id' | 'uploadedAt'>) =>
    request<NodeResource>('/lesson/node-resources/create', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  bind: (data: { nodeId: string; resourceId: string }) =>
    request<{ id: string }>('/lesson/node-resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unbind: (id: string) =>
    request<{ id: string }>(`/lesson/node-resources/${id}`, { method: 'DELETE' }),
}

export const courseResourceApi = {
  list: (params?: { courseId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<NodeResource>>(`/lesson/course-resources${buildQuery(params || {})}`),
  create: (req: Omit<NodeResource, 'id' | 'uploadedAt' | 'nodeId'> & { courseId: string }) =>
    request<NodeResource>('/lesson/course-resources/create', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  bind: (data: { courseId: string; resourceId: string }) =>
    request<{ id: string }>('/lesson/course-resources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unbind: (id: string) =>
    request<{ id: string }>(`/lesson/course-resources/${id}`, { method: 'DELETE' }),
}

export interface HybridModulePayload {
  moduleKey: string
  mode: 'online' | 'offline'
  data: Record<string, any>
}

export const hybridModuleApi = {
  list: (params?: { nodeId?: string; courseId?: string; limit?: number }) =>
    request<ListResponse<HybridNodeModule>>(`/lesson/hybrid-modules${buildQuery(params || {})}`),
  batchSave: (nodeId: string, modules: HybridModulePayload[]) =>
    request<{ nodeId: string }>('/lesson/hybrid-modules/batch', {
      method: 'POST',
      body: JSON.stringify({ nodeId, modules }),
    }),
}

export const lessonBatchApi = {
  ...createCrudApi<
    LessonBatch,
    Omit<LessonBatch, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<LessonBatch, 'id' | 'createdAt' | 'updatedAt'>>
  >('/lesson/batches'),
  updateStatus: (id: string, status: string) =>
    request<LessonBatch>(`/lesson/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
}

export interface NodeHomeworkSubmission {
  id: string
  studentId: string
  studentName: string
  content?: string
  attachmentUrls?: string[]
  status: 'submitted' | 'graded'
  score?: number
  totalScore?: number
  comment?: string
  createdAt?: string
  gradedAt?: string
}

export const nodeHomeworkApi = {
  create: (req: Omit<NodeHomework, 'id'>) =>
    request<NodeHomework>('/lesson/homeworks', { method: 'POST', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/lesson/homeworks/${id}`, { method: 'DELETE' }),
  submit: (
    nodeId: string,
    homeworkId: string,
    req: { content?: string; attachmentUrls?: string[] },
  ) =>
    request<{ id: string; status: string }>(
      `/lesson/nodes/${nodeId}/homeworks/${homeworkId}/submit`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
  listSubmissions: (nodeId: string, homeworkId: string) =>
    request<{ items: NodeHomeworkSubmission[] }>(
      `/lesson/nodes/${nodeId}/homeworks/${homeworkId}/submissions`,
    ),
  grade: (
    nodeId: string,
    homeworkId: string,
    submissionId: string,
    req: { score: number; comment?: string },
  ) =>
    request<{ id: string; status: string }>(
      `/lesson/nodes/${nodeId}/homeworks/${homeworkId}/submissions/${submissionId}/grade`,
      { method: 'POST', body: JSON.stringify(req) },
    ),
}

export interface NodeEvaluationResult {
  id: string
  nodeId: string
  methodKey: string
  evaluateeId: string
  evaluatorId?: string
  evaluatorType?: string
  status: 'pending' | 'evaluated'
  totalScore?: number
  maxScore: number
  evalPointScores?: Record<string, any>
  objectiveAnswers?: Record<string, any>
  subjectiveContent?: Record<string, any>
  drawnQuestions?: Record<string, any>
  comment?: string
  gradedAt?: string
  gradedBy?: string
}

export const nodeEvaluationResultApi = {
  list: (params?: { nodeId?: string; evaluateeId?: string; limit?: number; offset?: number }) =>
    request<{ items: NodeEvaluationResult[]; total: number }>(
      `/lesson/node-evaluation-results${buildQuery(params || {})}`,
    ),
  listByCourse: (courseId: string) =>
    request<{ items: NodeEvaluationResult[]; total: number }>(
      `/lesson/course-node-evaluation-results${buildQuery({ courseId })}`,
    ),
  get: (id: string) => request<NodeEvaluationResult>(`/lesson/node-evaluation-results/${id}`),
  grade: (id: string, req: { score: number; comment?: string }) =>
    request<{ ok: boolean }>(`/lesson/node-evaluation-results/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  submit: (req: {
    nodeId: string
    methodKey: string
    evaluateeId: string
    evaluatorId?: string
    evaluatorType?: string
    maxScore?: number
    objectiveAnswers?: Record<string, any>
    subjectiveContent?: Record<string, any>
    drawnQuestions?: Record<string, any>
    evalPointScores?: Record<string, any>
  }) =>
    request<NodeEvaluationResult>('/lesson/node-evaluation-results', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
}
