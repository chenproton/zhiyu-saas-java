// ============================================================
// 【演示数据】教师工作台占位 mock，非真实业务数据
// 当前已清空为默认值/空数组，仅用于演示页面结构
// 引用方：portal/workspace/_components 下的 teacher-dashboard-tab、teacher-courses-tab、
//         teacher-tracking-tab、teacher-assessment-tab、teacher-final-tab、
//         teacher-profile-tab、prep-associate-dialog 及 workspace/page.tsx
// 后续规划：接真实后端接口后删除本文件，引用方改为从 API 获取数据
// ============================================================

export interface TeacherInfo {
  id: string
  name: string
  avatar: string
  department: string
  title: string
  teacherNo: string
  courses: number
  students: number
}

export interface TeacherAnnouncement {
  id: string
  title: string
  date: string
  type: '重要' | '通知' | '公告' | '教务'
  isNew: boolean
}

export interface TeacherTodoItem {
  id: string
  title: string
  type: 'grade' | 'approve' | 'homework' | 'review'
  count: number
  urgent: boolean
  color: string
  deadline?: string
}

export interface TeacherCalendarEvent {
  id: string
  title: string
  time: string
  date: number
  color: string
  type: 'course' | 'meeting' | 'exam' | 'training'
}

export interface TeacherCourse {
  id: string
  name: string
  code: string
  type: string
  className: string
  term: string
  students: number
  hours: number
  progress: number
  cover: string
  status: '进行中' | '未开始' | '已结课'
  nextTask?: string
  nextDeadline?: string
}

export interface GradeSubmitItem {
  id: string
  courseName: string
  className: string
  students: number
  status: '已提交' | '待提交' | '录入中'
  deadline?: string
}

// ==================== 教师基本信息 ====================

export const mockTeacherInfo: TeacherInfo = {
  id: '',
  name: '老师',
  avatar: '?',
  department: '',
  title: '',
  teacherNo: '',
  courses: 0,
  students: 0,
}

// ==================== 通知公告 ====================

export const mockTeacherAnnouncements: TeacherAnnouncement[] = []

// ==================== 待办事项 ====================

export const mockTeacherTodos: TeacherTodoItem[] = []

// ==================== 教学日历事件 ====================

export const mockTeacherCalendarEvents: TeacherCalendarEvent[] = []

// ==================== 我的课程 ====================

export const mockTeacherCourses: TeacherCourse[] = []

// ==================== 开课计划-课程节次 ====================

export type TeacherScheduleEventType = 'course' | 'scene' | 'meeting' | 'training' | 'exam' | 'todo'

export interface TeacherScheduleEvent {
  id: string
  title: string
  type: TeacherScheduleEventType
  dayOfWeek: number
  period: string
  location?: string
  description?: string
  tag?: string
  className?: string
}

export const teacherPeriods = [
  '上午 1',
  '上午 2',
  '上午 3',
  '上午 4',
  '下午 1',
  '下午 2',
  '下午 3',
  '下午 4',
] as const

export const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// ==================== 备课关联数据 ====================

export interface PrepSubItem {
  id: string
  name: string
}

export interface PrepAssociationRecord {
  planId: string
  subItems: { id: string; name: string }[]
}

export const hybridCourseSessions: Record<string, PrepSubItem[]> = {}

export const scenarioTasks: Record<string, PrepSubItem[]> = {}

export const mockTeacherSchedule: TeacherScheduleEvent[] = []

// ==================== 成绩提交 ====================

export const mockGradeSubmissions: GradeSubmitItem[] = []

// ==================== 教学跟踪数据 ====================

export const mockSignInData = {
  total: 0,
  present: 0,
  late: 0,
  absent: 0,
  rate: 0,
}

export const mockSignInDaily: { date: string; present: number; late: number; absent: number }[] = []

export const mockQuizResults: {
  id: string
  name: string
  avgScore: number
  passRate: number
  count: number
  maxScore: number
}[] = []

export const mockRushAnswerRanking: {
  rank: number
  name: string
  correctCount: number
  avgTime: string
  badge: string
}[] = []

export const mockClassInteraction: { name: string; active: number; total: number }[] = []

export const mockAttendanceRateData: { name: string; rate: number }[] = []

export const mockStudentDetails: {
  name: string
  attendance: number
  quizAvg: number
  interaction: number
  praise: number
  grade: string
}[] = []

// ==================== 测评管理数据 ====================

export const mockHomeworkSubmissions: {
  id: string
  name: string
  deadline: string
  submitRate: number
  avgScore: number
  total: number
}[] = []

export const mockHomeworkTrend: { week: string; rate: number }[] = []

export const mockPeerReviewStats = {
  totalGroups: 0,
  avgPeerScore: 0,
  completionRate: 0,
  steps: [] as { name: string; weight: number; avgScore: number }[],
}

export const mockTrainingReports: {
  name: string
  submitted: number
  total: number
  rate: number
  avgScore: number
  rating: string
}[] = []

// ==================== 期末总评数据 ====================

export const mockSemesterSummary = {
  totalSessions: 0,
  avgAttendance: 0,
  compositeAvgScore: 0,
  totalStudents: 0,
  dataCollectionRate: 0,
  needAttention: 0,
}

export const mockAssessmentDimensions: {
  id: string
  name: string
  category: string
  weight: number
  avgScore: number
  status: string
  sessions: number
}[] = []

export const mockCompositeDistribution: { range: string; count: number }[] = []

export const mockSessionSummary: {
  week: number
  day: string
  topic: string
  attendance: number
  quizAvg: number
  homeworkRate: number
  homeworkAvg: number
}[] = []

export const mockStudentRanking: {
  rank: number
  name: string
  attendance: number
  inClassQuiz: number
  homework: number
  peerReview: number
  report: number
  total: number
  grade: string
}[] = []

// ==================== 学生画像数据 ====================

export const mockStudentPortraits: {
  id: string
  name: string
  studentNo: string
  className: string
  grade: string
  major: string
  overallGrade: string
  overallScore: number
  abilities: { name: string; score: number }[]
  attendance: number
}[] = []

// ==================== 教师个人中心 ====================

export const teacherSecurityItems: {
  label: string
  status: string
  statusText: string
  action: string
}[] = []
