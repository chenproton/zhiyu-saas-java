import type {
  AffairsBatch,
  AffairsTerm,
  AffairsTermPayload,
  TrainingProgram,
  TrainingProgramPayload,
  TrainingProgramCourse,
  TrainingProgramCoursePayload,
  TeachingPlan,
  TeachingPlanDetail,
  TeachingPlanEntry,
  TeachingPlanEntryUpdatePayload,
  Venue,
  VenuePayload,
  PeriodSlot,
  PeriodSlotPayload,
  ScheduleEntry,
  ScheduleEntryPayload,
  ScheduleConflict,
  TimetableResponse,
  MyScheduleResponse,
} from '../types/affairs'
import { request, authedFetch, buildQuery, downloadBlob, ListResponse } from '../api-helpers'
import { createCrudApi, createContentApi } from '../api-factory'

// ==================== 学期 ====================

export const termApi = createCrudApi<AffairsTerm, AffairsTermPayload, AffairsTermPayload>(
  '/affairs/terms',
)

// ==================== 人才培养方案 ====================

export const programApi = {
  ...createContentApi<TrainingProgram, TrainingProgramPayload, TrainingProgramPayload>(
    '/affairs/programs',
  ),
  /** draft/published 状态切换（默认切换为 published） */
  publish: (id: string, status: 'draft' | 'published' = 'published') =>
    request<TrainingProgram>(`/affairs/programs/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  listCourses: (id: string) =>
    request<ListResponse<TrainingProgramCourse>>(`/affairs/programs/${id}/courses`),
  /** 课程设置整体保存（全量替换） */
  saveCourses: (id: string, courses: TrainingProgramCoursePayload[]) =>
    request<ListResponse<TrainingProgramCourse>>(`/affairs/programs/${id}/courses`, {
      method: 'PUT',
      body: JSON.stringify({ courses }),
    }),
  clone: (id: string, body?: { name?: string; code?: string }) =>
    request<TrainingProgram>(`/affairs/programs/${id}/clone`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
}

// ==================== 教学计划 ====================

export const teachingPlanApi = {
  ...createContentApi<
    TeachingPlanDetail,
    { programId: string; termId: string },
    { batchId?: string; collaborators?: string[] }
  >('/affairs/teaching-plans'),
  /** 从人培方案生成教学计划；同一方案同一学期已存在时后端返回 409 */
  generate: (req: { programId: string; termId: string }) =>
    request<TeachingPlanDetail>('/affairs/teaching-plans', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  confirm: (id: string) =>
    request<TeachingPlan>(`/affairs/teaching-plans/${id}/confirm`, { method: 'POST' }),
  updateEntry: (id: string, req: TeachingPlanEntryUpdatePayload) =>
    request<TeachingPlanEntry>(`/affairs/teaching-plans/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  deleteEntry: (id: string) =>
    request<{ id: string }>(`/affairs/teaching-plans/entries/${id}`, { method: 'DELETE' }),
  /** 导出教学计划全部内容（计划信息 + 教学计划条目）为 Excel */
  exportExcel: async (id: string) => {
    const res = await authedFetch(`/affairs/teaching-plans/${encodeURIComponent(id)}/export`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    downloadBlob(await res.blob(), '教学计划导出.xlsx')
  },
}

// ==================== 场地 ====================

export const venueApi = createCrudApi<Venue, VenuePayload, VenuePayload>('/affairs/venues')

// ==================== 节次 ====================

export const periodSlotApi = {
  ...createCrudApi<PeriodSlot, PeriodSlotPayload, PeriodSlotPayload>('/affairs/period-slots'),
  /** 按名称整体替换节次（事务内原子落库），返回替换后的完整列表 */
  replace: (items: PeriodSlotPayload[]) =>
    request<ListResponse<PeriodSlot>>('/affairs/period-slots/replace', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
}

// ==================== 排课 ====================

/** 排课冲突错误（HTTP 409），conflicts 携带教师/班级/场地冲突明细 */
class ScheduleConflictError extends Error {
  conflicts: ScheduleConflict[]
  constructor(message: string, conflicts: ScheduleConflict[]) {
    super(message)
    this.name = 'ScheduleConflictError'
    this.conflicts = conflicts
  }
}

/** 排课创建/更新专用请求：409 时保留 conflicts 明细抛出 ScheduleConflictError */
async function scheduleRequest<T>(path: string, options: RequestInit): Promise<T> {
  const res = await authedFetch(path, options)
  const data = await res.json().catch(() => ({ error: '请求失败' }))
  if (!res.ok) {
    if (res.status === 409 && Array.isArray(data.conflicts)) {
      throw new ScheduleConflictError(data.error || '排课冲突', data.conflicts)
    }
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data as T
}

export const scheduleApi = {
  list: (params?: {
    termId?: string
    status?: string
    classNodeId?: string
    teacherId?: string
    type?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<ScheduleEntry>>(`/affairs/schedules${buildQuery(params || {})}`),
  create: (req: ScheduleEntryPayload) =>
    scheduleRequest<ScheduleEntry>('/affairs/schedules', {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  update: (id: string, req: ScheduleEntryPayload) =>
    scheduleRequest<ScheduleEntry>(`/affairs/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) => request<{ id: string }>(`/affairs/schedules/${id}`, { method: 'DELETE' }),
  /** 按学期批量发布（draft → published，version+1） */
  publish: (termId: string) =>
    request<{ published: number; version: number }>('/affairs/schedules/publish', {
      method: 'POST',
      body: JSON.stringify({ termId }),
    }),
  /** 导出当前学期排课为 Excel（格式与导入模板一致） */
  exportExcel: async (termId: string) => {
    const res = await authedFetch(`/affairs/schedules/export?termId=${encodeURIComponent(termId)}`)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${res.status}`)
    }
    downloadBlob(await res.blob(), '排课导出.xlsx')
  },
  /** 班级/教师课表视图（默认仅 published，含 version） */
  timetable: (params: {
    termId: string
    classNodeId?: string
    teacherId?: string
    status?: string
  }) => request<TimetableResponse>(`/affairs/schedules/timetable${buildQuery(params)}`),
  /** 自动为教学计划待排条目分配时间+场地 */
  autoSchedule: (req: { termId: string; planId?: string }) =>
    request<{ success: number; failed: number; failures: string[] }>(
      '/affairs/schedules/auto-schedule',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    ),
}

// ==================== 我的课表（学生/教师工作台） ====================

export const myScheduleApi = {
  /** termId 缺省时取当前学期 */
  get: (termId?: string) =>
    request<MyScheduleResponse>(`/portal/workspace/my-schedule${buildQuery({ termId })}`),
}

// ==================== 批次管理 ====================

export const affairsBatchApi = {
  ...createCrudApi<AffairsBatch, Omit<AffairsBatch, 'id'>, Partial<Omit<AffairsBatch, 'id'>>>(
    '/affairs/batches',
  ),
  updateStatus: (id: string, status: string) =>
    request<AffairsBatch>(`/affairs/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
}
