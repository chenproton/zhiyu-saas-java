import { createContentApi, createCrudApi, request, buildQuery } from './http';
import type { ListResponse } from './http';
import type { Scenario, ScenarioTask, TaskResource, TaskResourceBinding } from '@/types/scene';

type ScenarioCreate = Partial<Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>>;
type ScenarioUpdate = Partial<Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'>>;

export const scenarioApi = createContentApi<Scenario, ScenarioCreate, ScenarioUpdate>('/scene/scenarios');

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
