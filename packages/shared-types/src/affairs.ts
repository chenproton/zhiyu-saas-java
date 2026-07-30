// 教务管理服务平台类型（学期 / 人才培养方案 / 教学计划）

/** 学期 */
export interface AffairsTerm {
  id: string
  name: string
  startDate: string
  endDate: string
  weeksCount: number
  isCurrent: boolean
  createdAt: string
}

export interface AffairsTermPayload {
  name: string
  startDate: string
  endDate: string
  weeksCount: number
  isCurrent: boolean
}

/** 人才培养方案（status: draft/published） */
export interface TrainingProgram {
  id: string
  name: string
  code?: string
  majorId?: string
  majorName?: string
  entryYear: number
  level?: string
  duration?: number
  totalCredits?: number
  status: string
  description?: string
  courseCount: number
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export interface TrainingProgramPayload {
  name: string
  code?: string
  majorId?: string
  entryYear: number
  level?: string
  duration?: number
  totalCredits?: number
  description?: string
}

/** 人培方案课程（nature: 必修/选修/实践/场景；场景课程通过 scenarioId 关联已有场景） */
export interface TrainingProgramCourse {
  id: string
  programId: string
  name: string
  code?: string
  credits: number
  hours: number
  theoryHours: number
  practiceHours: number
  semester: number
  nature: string
  assessment?: string
  scenarioId?: string
  scenarioName?: string
  sortOrder: number
}

export interface TrainingProgramCoursePayload {
  name: string
  code?: string
  credits: number
  hours: number
  theoryHours: number
  practiceHours: number
  semester: number
  nature: string
  assessment?: string
  scenarioId?: string
  sortOrder: number
}

/** 教学计划（status: draft/confirmed） */
export interface TeachingPlan {
  id: string
  programId: string
  programName?: string
  termId: string
  termName?: string
  majorId?: string
  majorName?: string
  entryYear: number
  status: string
  entryCount: number
  generatedAt: string
  confirmedAt?: string
}

/** 教学计划条目（type: theory/practice/scene；status: planned/scheduled） */
export interface TeachingPlanEntry {
  id: string
  planId: string
  courseName: string
  courseCode?: string
  type: string
  nature?: string
  credits: number
  totalHours: number
  weekHours: number
  startWeek: number
  endWeek: number
  weekPattern: string
  classNodeId?: string
  className?: string
  teacherId?: string
  teacherName?: string
  teacherType?: string
  venueType?: string
  scenarioId?: string
  scenarioName?: string
  status: string
}

/** 教学计划详情（含 entries） */
export interface TeachingPlanDetail extends TeachingPlan {
  entries: TeachingPlanEntry[]
}

/** 场地（type: 教室/机房/实训室/实验室/校外基地） */
export interface Venue {
  id: string
  name: string
  type: string
  capacity?: number
  createdAt: string
}

export interface VenuePayload {
  name: string
  type: string
  capacity?: number
}

/** 节次（课表行） */
export interface PeriodSlot {
  id: string
  name: string
  sortOrder: number
  startTime?: string
  endTime?: string
}

export interface PeriodSlotPayload {
  name: string
  sortOrder: number
  startTime?: string
  endTime?: string
}

/** 排课结果（type: traditional/scene；status: draft/published） */
export interface ScheduleEntry {
  id: string
  termId: string
  planEntryId?: string
  courseName: string
  courseCode?: string
  type: string
  classNodeId: string
  className?: string
  teacherId?: string
  teacherName?: string
  dayOfWeek: number
  periods: string[]
  startWeek: number
  endWeek: number
  weekPattern: string
  venueId?: string
  venueName?: string
  scenarioId?: string
  scenarioName?: string
  source: string
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface ScheduleEntryPayload {
  termId: string
  planEntryId?: string
  courseName: string
  courseCode?: string
  type?: string
  classNodeId: string
  teacherId?: string
  dayOfWeek: number
  periods: string[]
  startWeek: number
  endWeek: number
  weekPattern?: string
  venueId?: string
  scenarioId?: string
}

/** 排课冲突详情（409 响应体 conflicts 数组元素） */
export interface ScheduleConflict {
  kind: string // teacher/class/venue
  entryId: string
  courseName: string
  className?: string
  teacherName?: string
  venueName?: string
  dayOfWeek: number
  periods: string[]
  startWeek: number
  endWeek: number
  weekPattern: string
}

/** 课表视图响应（班级/教师视角，默认仅 published） */
export interface TimetableResponse {
  items: ScheduleEntry[]
  total: number
  version: number
}

/** 我的课表响应（学生→班级课表，教师→本人课表） */
export interface MyScheduleResponse {
  term: AffairsTerm
  viewAs: string
  items: ScheduleEntry[]
  total: number
}

export interface TeachingPlanEntryUpdatePayload {
  weekHours?: number
  startWeek?: number
  endWeek?: number
  weekPattern?: string
  classNodeId?: string
  teacherId?: string
  teacherType?: string
  venueType?: string
  status?: string
}
