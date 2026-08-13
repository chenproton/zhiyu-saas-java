import type {
  Course,
  KnowledgePoint,
  SystemCourseNode as BackendSystemCourseNode,
  NodeResource,
  LessonBatch,
  HybridNodeModule,
} from '../types/lesson'
import type { SystemCourseNode } from '../types/lesson-source'
import type { CitationStats, UncitedItem } from '../types/citation'
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

export const knowledgeApi = {
  ...createCrudApi<
    KnowledgePoint,
    Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>>
  >('/lesson/knowledge-points'),
  citationStats: () =>
    request<CitationStats>('/lesson/knowledge-points/citation-stats'),
  uncited: (params?: { startDate?: string; endDate?: string; limit?: number; offset?: number }) =>
    request<ListResponse<UncitedItem>>(
      `/lesson/knowledge-points/uncited${buildQuery(params || {})}`,
    ),
}

export const courseNodeApi = {
  ...createCrudApi<
    SystemCourseNode,
    Omit<BackendSystemCourseNode, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<BackendSystemCourseNode, 'id' | 'createdAt' | 'updatedAt'>>
  >('/lesson/nodes'),
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
