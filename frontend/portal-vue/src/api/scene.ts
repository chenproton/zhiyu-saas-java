import { createContentApi, createCrudApi, request } from './http';
import type { Scenario, ScenarioTask } from '@/types/scene';

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
