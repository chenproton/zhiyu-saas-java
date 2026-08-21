import { createContentApi, createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type { Course, SystemCourseNode, KnowledgePoint, NodeEvaluationResult } from '@/types/lesson';

type CourseCreate = Partial<
  Omit<Course, 'id' | 'nodeCount' | 'resourceCount' | 'studyCount' | 'createdAt' | 'updatedAt'>
>;
type CourseUpdate = Partial<Omit<Course, 'id' | 'createdAt' | 'updatedAt'>>;

export const courseApi = createContentApi<Course, CourseCreate, CourseUpdate>('/lesson/courses');

export const courseNodeApi = {
  ...createCrudApi<SystemCourseNode, Partial<Omit<SystemCourseNode, 'id'>>, Partial<Omit<SystemCourseNode, 'id'>>>(
    '/lesson/nodes'
  ),
  reorder: (courseId: string, nodeIds: string[]) =>
    request<{ ok: boolean }>('/lesson/nodes/reorder', {
      method: 'POST',
      body: JSON.stringify({ courseId, nodeIds })
    })
};

export const knowledgeApi = createCrudApi<
  KnowledgePoint,
  Partial<Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>>,
  Partial<Omit<KnowledgePoint, 'id' | 'createdAt' | 'updatedAt'>>
>('/lesson/knowledge-points');

export const lessonBatchApi = {
  ...createCrudApi<any, Record<string, unknown>, Record<string, unknown>>('/lesson/batches'),
  updateStatus: (id: string, status: string) =>
    request<unknown>(`/lesson/batches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
};

export const nodeEvaluationResultApi = {
  list: (params?: { nodeId?: string; evaluateeId?: string; limit?: number; offset?: number }) =>
    request<ListResponse<NodeEvaluationResult>>(`/lesson/node-evaluation-results${buildQuery(params || {})}`),
  listByCourse: (courseId: string) =>
    request<ListResponse<NodeEvaluationResult>>(`/lesson/course-node-evaluation-results${buildQuery({ courseId })}`),
  get: (id: string) => request<NodeEvaluationResult>(`/lesson/node-evaluation-results/${id}`),
  grade: (id: string, req: { score: number; comment?: string }) =>
    request<{ ok: boolean }>(`/lesson/node-evaluation-results/${id}/grade`, {
      method: 'POST',
      body: JSON.stringify(req)
    })
};
