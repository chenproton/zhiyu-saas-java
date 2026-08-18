// ==================== 学生课程表数据（参考 zhiyu-registrar 数据结构）====================

export const allPeriods = [
  '早自习 1',
  '上午 1',
  '上午 2',
  '上午 3',
  '上午 4',
  '下午 1',
  '下午 2',
  '下午 3',
  '下午 4',
  '晚自习 1',
] as const

export type ScheduleEventType = 'course' | 'scene' | 'exam' | 'todo'

export interface ScheduleEvent {
  id: string
  title: string
  type: ScheduleEventType
  dayOfWeek: number // 1 = 周一，7 = 周日
  period: string
  teacher?: string
  location?: string
  description?: string
  tag?: string
  status?: string
  scenarioId?: string
  courseId?: string
}

export const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
