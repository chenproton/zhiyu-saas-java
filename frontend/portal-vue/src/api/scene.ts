import { createContentApi, createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  Scenario,
  ScenarioSnapshot,
  ScenarioTask,
  TaskEvaluationMethod,
  TaskResource,
  TaskResourceBinding
} from '@/types/scene';

type ScenarioCreate = Partial<Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>>;
type ScenarioUpdate = Partial<Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>>;

export const scenarioApi = {
  ...createContentApi<Scenario, ScenarioCreate, ScenarioUpdate>('/scene/scenarios'),
  /** 场景快照 bundle（?version= 可选，缺省最新已发布快照；对齐 React scenarioApi.getSnapshot） */
  getSnapshot: (id: string, params?: { version?: string }) =>
    request<ScenarioSnapshot>(`/scene/scenarios/${id}/snapshot${buildQuery(params || {})}`)
};

// 任务评价方式（对齐 React taskEvaluationApi；Java 端 SceneEvalMethodController /api/v1/scene）
export const taskEvaluationApi = {
  listMethods: (taskId: string) =>
    request<{ methods: TaskEvaluationMethod[] }>(`/scene/tasks/${taskId}/evaluation-methods`)
};

export const taskApi = {
  ...createCrudApi<ScenarioTask, Partial<Omit<ScenarioTask, 'id'>>, Partial<Omit<ScenarioTask, 'id'>>>(
    '/scene/tasks'
  ),
  reorder: (scenarioId: string, taskIds: string[]) =>
    request<{ ok: boolean }>('/scene/tasks/reorder', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, taskIds })
    })
};

export const sceneBatchApi = {
  ...createCrudApi<any, Record<string, unknown>, Record<string, unknown>>('/scene/batches'),
  updateStatus: (id: string, status: string) =>
    request<unknown>(`/scene/batches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
};

// 场景任务资源绑定（对齐 React scene.ts taskResourceApi）
export const taskResourceApi = {
  listResources: (params?: { taskId?: string; search?: string; limit?: number; offset?: number }) =>
    request<ListResponse<TaskResource>>(`/scene/task-resources${buildQuery(params || {})}`),
  create: (req: Omit<TaskResource, 'id' | 'uploadedAt'>) =>
    request<TaskResource>('/scene/task-resources/create', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  bindResource: (data: { taskId: string; resourceId: string }) =>
    request<TaskResourceBinding>('/scene/task-resources', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  unbindResource: (id: string) =>
    request<{ id: string }>(`/scene/task-resources/${id}`, { method: 'DELETE' })
};
