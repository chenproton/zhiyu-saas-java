import type {
  Scenario,
  ScenarioTask,
  TaskResource,
  TaskResourceBinding,
  SceneBatch,
  RubricTemplate,
  TaskEvaluationMethod,
  ScenarioWeightConfig,
} from '../types/scene'
import { request, buildQuery, ListResponse } from '../api-helpers'
import { createCrudApi, createContentApi } from '../api-factory'

export const scenarioApi = {
  ...createContentApi<
    Scenario,
    Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>>
  >('/scene/scenarios'),
  clone: (id: string, body?: { name?: string; code?: string }) =>
    request<Scenario>(`/scene/scenarios/${id}/clone`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
}

export const scenarioWeightApi = {
  list: (params?: { scenarioId?: string; taskId?: string }) =>
    request<ListResponse<ScenarioWeightConfig>>(`/scene/weights${buildQuery(params || {})}`),
  upsert: (req: { id?: string; scenarioId: string; taskId: string; weight: number }) =>
    request<ScenarioWeightConfig>(`/scene/weights${req.id ? `/${req.id}` : ''}`, {
      method: req.id ? 'PUT' : 'POST',
      body: JSON.stringify(req),
    }),
}

export const taskApi = {
  list: (params?: { scenarioId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<ScenarioTask>>(`/scene/tasks${buildQuery(params || {})}`),
  get: (id: string) => request<ScenarioTask>(`/scene/tasks/${id}`),
  create: (req: Omit<ScenarioTask, 'id'>) =>
    request<ScenarioTask>('/scene/tasks', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: Partial<Omit<ScenarioTask, 'id'>>) =>
    request<ScenarioTask>(`/scene/tasks/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/scene/tasks/${id}`, { method: 'DELETE' }),
  reorder: (scenarioId: string, taskIds: string[]) =>
    request<{ ok: boolean }>('/scene/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, taskIds }),
    }),
}

export const sceneBatchApi = {
  ...createCrudApi<
    SceneBatch,
    Omit<SceneBatch, 'id' | 'createdAt' | 'updatedAt'>,
    Partial<Omit<SceneBatch, 'id' | 'createdAt' | 'updatedAt'>>
  >('/scene/batches'),
  updateStatus: (id: string, status: string) =>
    request<SceneBatch>(`/scene/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
}

export const taskResourceApi = {
  listResources: (params?: { taskId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<TaskResource>>(`/scene/task-resources${buildQuery(params || {})}`),
  create: (req: Omit<TaskResource, 'id' | 'uploadedAt'>) =>
    request<TaskResource>('/scene/task-resources/create', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  bindResource: (data: { taskId: string; resourceId: string }) =>
    request<TaskResourceBinding>(`/scene/task-resources`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unbindResource: (id: string) =>
    request<{ id: string }>(`/scene/task-resources/${id}`, { method: 'DELETE' }),
}

export const taskEvaluationApi = {
  listMethods: (taskId: string) =>
    request<{ methods: TaskEvaluationMethod[] }>(`/scene/tasks/${taskId}/evaluation-methods`),
  saveMethods: (taskId: string, data: { version?: number; methods: any[] }) =>
    request<{ methods: TaskEvaluationMethod[] }>(`/scene/tasks/${taskId}/evaluation-methods`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  listTemplates: (params?: { limit?: number; offset?: number; keyword?: string }) =>
    request<{ items: RubricTemplate[]; total: number }>(
      `/scene/rubric-templates${buildQuery(params || {})}`,
    ),
  getTemplate: (id: string) => request<RubricTemplate>(`/scene/rubric-templates/${id}`),
  createTemplate: (data: {
    name: string
    mode: string
    types?: string[]
    description?: string
    data: Record<string, any>
  }) =>
    request<RubricTemplate>(`/scene/rubric-templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (
    id: string,
    data: {
      name: string
      mode: string
      types?: string[]
      description?: string
      data: Record<string, any>
    },
  ) =>
    request<RubricTemplate>(`/scene/rubric-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) =>
    request<{ id: string }>(`/scene/rubric-templates/${id}`, { method: 'DELETE' }),
}
