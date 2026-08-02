import type {
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

// ==================== 学期 ====================

export const termApi = {
  list: (params?: { search?: string; isCurrent?: boolean; limit?: number; offset?: number }) =>
    request<ListResponse<AffairsTerm>>(`/affairs/terms${buildQuery(params || {})}`),
  create: (req: AffairsTermPayload) =>
    request<AffairsTerm>('/affairs/terms', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: AffairsTermPayload) =>
    request<AffairsTerm>(`/affairs/terms/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/affairs/terms/${id}`, { method: 'DELETE' }),
}

// ==================== 人才培养方案 ====================

export const programApi = {
  list: (params?: {
    search?: string
    status?: string
    majorId?: string
    entryYear?: number
    limit?: number
    offset?: number
  }) => request<ListResponse<TrainingProgram>>(`/affairs/programs${buildQuery(params || {})}`),
  get: (id: string) => request<TrainingProgram>(`/affairs/programs/${id}`),
  create: (req: TrainingProgramPayload) =>
    request<TrainingProgram>('/affairs/programs', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: TrainingProgramPayload) =>
    request<TrainingProgram>(`/affairs/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) => request<{ id: string }>(`/affairs/programs/${id}`, { method: 'DELETE' }),
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
  submit: (id: string) =>
    request<TrainingProgram>(`/affairs/programs/${id}/submit`, { method: 'POST' }),
  review: (id: string, req: { status: string; comment?: string }) =>
    request<TrainingProgram>(`/affairs/programs/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(req),
    }),
  archive: (id: string) =>
    request<TrainingProgram>(`/affairs/programs/${id}/archive`, { method: 'POST' }),
  unpublish: (id: string) =>
    request<TrainingProgram>(`/affairs/programs/${id}/unpublish`, { method: 'POST' }),
  withdraw: (id: string) =>
    request<TrainingProgram>(`/affairs/programs/${id}/withdraw`, { method: 'POST' }),
  invite: (id: string, userId: string) =>
    request<TrainingProgram>(`/affairs/programs/${id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
}

// ==================== 教学计划 ====================

export const teachingPlanApi = {
  list: (params?: {
    termId?: string
    programId?: string
    status?: string
    majorId?: string
    limit?: number
    offset?: number
  }) => request<ListResponse<TeachingPlan>>(`/affairs/teaching-plans${buildQuery(params || {})}`),
  get: (id: string) => request<TeachingPlanDetail>(`/affairs/teaching-plans/${id}`),
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
}

// ==================== 场地 ====================

export const venueApi = {
  list: (params?: { search?: string; type?: string; limit?: number; offset?: number }) =>
    request<ListResponse<Venue>>(`/affairs/venues${buildQuery(params || {})}`),
  create: (req: VenuePayload) =>
    request<Venue>('/affairs/venues', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: VenuePayload) =>
    request<Venue>(`/affairs/venues/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<{ id: string }>(`/affairs/venues/${id}`, { method: 'DELETE' }),
}

// ==================== 节次 ====================

export const periodSlotApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    request<ListResponse<PeriodSlot>>(`/affairs/period-slots${buildQuery(params || {})}`),
  create: (req: PeriodSlotPayload) =>
    request<PeriodSlot>('/affairs/period-slots', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: PeriodSlotPayload) =>
    request<PeriodSlot>(`/affairs/period-slots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req),
    }),
  delete: (id: string) =>
    request<{ id: string }>(`/affairs/period-slots/${id}`, { method: 'DELETE' }),
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
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    request<any>(`/affairs/batches${buildQuery(params || {})}`),
  get: (id: string) => request<any>(`/affairs/batches/${id}`),
  create: (req: any) =>
    request<any>('/affairs/batches', { method: 'POST', body: JSON.stringify(req) }),
  update: (id: string, req: any) =>
    request<any>(`/affairs/batches/${id}`, { method: 'PUT', body: JSON.stringify(req) }),
  delete: (id: string) => request<any>(`/affairs/batches/${id}`, { method: 'DELETE' }),
  updateStatus: (id: string, status: string) =>
    request<any>(`/affairs/batches/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
}
