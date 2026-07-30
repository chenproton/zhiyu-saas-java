import type {
  Course,
  KnowledgePoint,
  SystemCourseNode as BackendSystemCourseNode,
  NodeQuiz,
  NodeHomework,
  NodeResource,
  LessonBatch,
  LessonBehaviorRecord,
  LessonBehaviorAggregate,
} from "../types/lesson"
import type { SystemCourseNode } from "../types/lesson-source"
import { request, buildQuery, ListResponse } from "../api-helpers"
import { createCrudApi, createContentApi } from "../api-factory"

export const courseApi = createContentApi<Course, Omit<Course, "id" | "nodeCount" | "resourceCount" | "studyCount" | "createdAt" | "updatedAt">, Partial<Omit<Course, "id" | "createdAt" | "updatedAt">>>("/lesson/courses")

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
  type: "exam"
}

export interface CourseAssessmentHomework {
  id: string
  title: string
  requirement: string
  needAttachment: boolean
  deadline?: string
  status: string
  type: "homework"
}

export interface CourseAssessmentsResponse {
  exams: CourseAssessmentExam[]
  homeworks: CourseAssessmentHomework[]
}

export const courseAssessmentsApi = {
  get: (courseId: string) => request<CourseAssessmentsResponse>(`/lesson/courses/${courseId}/assessments`),
}

export const knowledgeApi = createCrudApi<KnowledgePoint, Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">, Partial<Omit<KnowledgePoint, "id" | "createdAt" | "updatedAt">>>("/lesson/knowledge-points")

export const courseNodeApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<SystemCourseNode>>(`/lesson/nodes${buildQuery(params || {})}`),
  get: (id: string) =>
    request<SystemCourseNode>(`/lesson/nodes/${id}`),
  create: (req: Omit<BackendSystemCourseNode, "id" | "createdAt" | "updatedAt">) =>
    request<SystemCourseNode>("/lesson/nodes", { method: "POST", body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<BackendSystemCourseNode, "id" | "createdAt" | "updatedAt">>) =>
    request<SystemCourseNode>(`/lesson/nodes/${id}`, { method: "PUT", body: JSON.stringify(req) }),
  delete: (id: string) =>
    request<{ id: string }>(`/lesson/nodes/${id}`, { method: "DELETE" }),
  reorder: (courseId: string, nodeIds: string[]) =>
    request<{ ok: boolean }>("/lesson/nodes/reorder", { method: "POST", body: JSON.stringify({ courseId, nodeIds }) }),
}

export const nodeResourceApi = {
  list: (params?: { courseId?: string; nodeId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<NodeResource>>(`/lesson/node-resources${buildQuery(params || {})}`),
  create: (req: Omit<NodeResource, "id" | "uploadedAt">) =>
    request<NodeResource>("/lesson/node-resources/create", { method: "POST", body: JSON.stringify(req) }),
  bind: (data: { nodeId: string; resourceId: string }) =>
    request<{ id: string }>("/lesson/node-resources", { method: "POST", body: JSON.stringify(data) }),
  unbind: (id: string) =>
    request<{ id: string }>(`/lesson/node-resources/${id}`, { method: "DELETE" }),
}

export const courseResourceApi = {
  list: (params?: { courseId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<NodeResource>>(`/lesson/course-resources${buildQuery(params || {})}`),
  create: (req: Omit<NodeResource, "id" | "uploadedAt" | "nodeId"> & { courseId: string }) =>
    request<NodeResource>("/lesson/course-resources/create", { method: "POST", body: JSON.stringify(req) }),
  bind: (data: { courseId: string; resourceId: string }) =>
    request<{ id: string }>("/lesson/course-resources", { method: "POST", body: JSON.stringify(data) }),
  unbind: (id: string) =>
    request<{ id: string }>(`/lesson/course-resources/${id}`, { method: "DELETE" }),
}

export const lessonBatchApi = {
  ...createCrudApi<LessonBatch, Omit<LessonBatch, "id" | "createdAt" | "updatedAt">, Partial<Omit<LessonBatch, "id" | "createdAt" | "updatedAt">>>("/lesson/batches"),
  updateStatus: (id: string, status: string) =>
    request<LessonBatch>(`/lesson/batches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
}

export const lessonBehaviorApi = {
  aggregate: (params: { courseId: string; startDate?: string; endDate?: string }) =>
    request<LessonBehaviorAggregate>(`/lesson/behavior-collection/aggregate${buildQuery(params)}`),
  create: (req: Omit<LessonBehaviorRecord, "id" | "createdAt" | "updatedAt">) =>
    request<LessonBehaviorRecord>("/lesson/behavior-collection/records", { method: "POST", body: JSON.stringify(req) }),
}

export const nodeQuizApi = {
  create: (req: Omit<NodeQuiz, "id">) =>
    request<NodeQuiz>("/lesson/quizzes", { method: "POST", body: JSON.stringify(req) }),
  delete: (id: string) =>
    request<{ id: string }>(`/lesson/quizzes/${id}`, { method: "DELETE" }),
}

export const nodeHomeworkApi = {
  create: (req: Omit<NodeHomework, "id">) =>
    request<NodeHomework>("/lesson/homeworks", { method: "POST", body: JSON.stringify(req) }),
  delete: (id: string) =>
    request<{ id: string }>(`/lesson/homeworks/${id}`, { method: "DELETE" }),
}
