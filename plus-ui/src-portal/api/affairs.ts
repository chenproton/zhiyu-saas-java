import { createContentApi, createCrudApi, request, authedFetch, buildQuery } from './http';
import type { ListResponse } from './http';
import type {
  TrainingProgram,
  AffairsTerm,
  TeachingPlan,
  TeachingPlanDetail,
  TeachingPlanEntry,
  TeachingPlanEntryUpdatePayload,
  Venue,
  PeriodSlot,
  ScheduleEntry,
  ScheduleEntryPayload,
  ScheduleConflict,
  TimetableResponse,
  TrainingProgramCourse,
  TrainingProgramCoursePayload
} from '@/types/affairs';

type ProgramCreate = Partial<Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt'>>;
type ProgramUpdate = Partial<Omit<TrainingProgram, 'id' | 'createdAt' | 'updatedAt'>>;

export const programApi = {
  ...createContentApi<TrainingProgram, ProgramCreate, ProgramUpdate>('/affairs/programs'),
  listCourses: (id: string) =>
    request<ListResponse<TrainingProgramCourse>>(`/affairs/programs/${id}/courses`),
  saveCourses: (id: string, courses: TrainingProgramCoursePayload[]) =>
    request<ListResponse<TrainingProgramCourse>>(`/affairs/programs/${id}/courses`, {
      method: 'PUT',
      body: JSON.stringify({ courses })
    })
};

export const affairsBatchApi = createCrudApi<any, Record<string, unknown>, Record<string, unknown>>(
  '/affairs/batches'
);

export const termApi = createCrudApi<
  AffairsTerm,
  Partial<Omit<AffairsTerm, 'id' | 'createdAt'>>,
  Partial<Omit<AffairsTerm, 'id' | 'createdAt'>>
>('/affairs/terms');

export const teachingPlanApi = {
  ...createContentApi<TeachingPlanDetail, { programId: string; termId: string }, { batchId?: string; collaborators?: string[] }>(
    '/affairs/teaching-plans'
  ),
  generate: (req: { programId: string; termId: string }) =>
    request<TeachingPlanDetail>('/affairs/teaching-plans', { method: 'POST', body: JSON.stringify(req) }),
  confirm: (id: string) => request<TeachingPlan>(`/affairs/teaching-plans/${id}/confirm`, { method: 'POST' }),
  updateEntry: (id: string, req: TeachingPlanEntryUpdatePayload) =>
    request<TeachingPlanEntry>(`/affairs/teaching-plans/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  exportExcel: async (id: string) => {
    const res = await authedFetch(`/affairs/teaching-plans/${encodeURIComponent(id)}/export`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '教学计划导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
};

export const venueApi = createCrudApi<
  Venue,
  Partial<Omit<Venue, 'id' | 'createdAt'>>,
  Partial<Omit<Venue, 'id' | 'createdAt'>>
>('/affairs/venues');

export const periodSlotApi = {
  ...createCrudApi<
    PeriodSlot,
    Partial<Omit<PeriodSlot, 'id'>>,
    Partial<Omit<PeriodSlot, 'id'>>
  >('/affairs/period-slots'),
  /** 按名称整体替换节次（事务内原子落库），返回替换后的完整列表（对齐 React PUT /affairs/period-slots/replace） */
  replace: (items: Omit<PeriodSlot, 'id'>[]) =>
    request<ListResponse<PeriodSlot>>('/affairs/period-slots/replace', {
      method: 'PUT',
      body: JSON.stringify({ items })
    })
};

async function scheduleRequest<T>(path: string, options: RequestInit): Promise<T> {
  const res = await authedFetch(path, options);
  const data = await res.json().catch(() => ({ error: '请求失败' }));
  if (!res.ok) {
    if (res.status === 409 && Array.isArray((data as { conflicts?: ScheduleConflict[] }).conflicts)) {
      const err = new Error((data as { error?: string }).error || '排课冲突') as Error & { conflicts: ScheduleConflict[] };
      err.conflicts = (data as { conflicts?: ScheduleConflict[] }).conflicts || [];
      throw err;
    }
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const scheduleApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request<ListResponse<ScheduleEntry>>(`/affairs/schedules${buildQuery(params || {})}`),
  create: (req: ScheduleEntryPayload) =>
    scheduleRequest<ScheduleEntry>('/affairs/schedules', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: ScheduleEntryPayload) =>
    scheduleRequest<ScheduleEntry>(`/affairs/schedules/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/affairs/schedules/${id}`, { method: 'DELETE' }),
  publish: (termId: string) =>
    request<{ published: number; version: number }>('/affairs/schedules/publish', {
      method: 'POST',
      body: JSON.stringify({ termId })
    }),
  timetable: (params: { termId: string; classNodeId?: string; teacherId?: string; status?: string }) =>
    request<TimetableResponse>(`/affairs/schedules/timetable${buildQuery(params)}`),
  autoSchedule: (req: { termId: string; planId?: string }) =>
    request<{ success: number; failed: number; failures: string[] }>('/affairs/schedules/auto-schedule', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  exportExcel: async (termId: string) => {
    const res = await authedFetch(`/affairs/schedules/export?termId=${encodeURIComponent(termId)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '排课导出.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
};
