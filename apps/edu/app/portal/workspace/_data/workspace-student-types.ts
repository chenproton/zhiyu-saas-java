// ============================================================
// 学生工作台类型定义与占位数据（已清空为默认值/空数组，接入真实 API 后填充）
// 当前已清空为默认值/空数组，仅用于演示页面结构
// 引用方：portal/workspace/_components 下的 profile-tab、archive-content、
//         community-tab、grades-content、schedule-grid 等组件
// 接入真实后端接口后，数据常量改为从 API 获取
// ============================================================

export interface StudentInfo {
  id: string
  name: string
  avatar: string
  major: string
  grade: string
  className: string
  studentNo: string
  credits: number
  totalCredits: number
  gpa: string
}

export interface Announcement {
  id: string
  title: string
  date: string
  type: '重要' | '通知' | '公告'
  isNew: boolean
}

export interface TodoItem {
  id: string
  title: string
  type: 'course' | 'scene' | 'exam' | 'report'
  count: number
  urgent: boolean
  color: string
  deadline?: string
}

export interface CalendarEvent {
  id: string
  title: string
  time: string
  date: number
  color: string
  type: 'course' | 'scene' | 'exam'
}

export interface Course {
  id: string
  name: string
  code: string
  type: '公共基础课' | '专业基础课' | '专业核心课' | '素质拓展课'
  teacher: string
  credit: number
  hours: number
  progress: number
  cover: string
  status: '进行中' | '未开始' | '已完成'
  nextTask?: string
  nextDeadline?: string
}

export interface SceneTask {
  id: string
  sceneName: string
  taskName: string
  position: string
  abilityTags: string[]
  status: '未开始' | '进行中' | '待提交' | '已批改' | '已完成'
  deadline: string
  score?: number
  totalScore: number
  difficulty: '简单' | '中等' | '困难'
}

export interface Position {
  id: string
  name: string
  industry: string
  company: string
  salary: string
  location: string
  abilityCount: number
  matchScore: number
  tags: string[]
  description: string
  isFavorite: boolean
}

export interface Exam {
  id: string
  name: string
  type: '随堂测' | '单元测试' | '在线测评' | '岗位能力认定'
  status: '待考' | '进行中' | '已完成'
  startTime: string
  endTime: string
  duration: number
  score?: number
  totalScore: number
}

export interface AbilityDimension {
  name: string
  score: number
  fullScore: number
}

export interface AbilityGap {
  ability: string
  current: number
  required: number
  gap: number
}

export interface ArchiveItem {
  id: string
  title: string
  type: 'award' | 'certificate' | 'project' | 'practice' | 'competition'
  date: string
  level: string
  description: string
  issuer?: string
}

export interface Topic {
  id: string
  title: string
  author: string
  avatar: string
  replies: number
  views: number
  lastReply: string
  tag: string
  isHot: boolean
}

export const mockStudentInfo: StudentInfo = {
  id: '',
  name: '同学',
  avatar: '?',
  major: '',
  grade: '',
  className: '',
  studentNo: '',
  credits: 0,
  totalCredits: 0,
  gpa: '-',
}

export const mockAnnouncements: Announcement[] = []

export const mockTodos: TodoItem[] = []

export const mockCalendarEvents: CalendarEvent[] = []

export const mockPositions: Position[] = []

export const mockAbilityDimensions: AbilityDimension[] = []

export const mockAbilityGaps: AbilityGap[] = []

export const mockWeeklyActivity: { day: string; value: number }[] = []

export const mockMonthlyTrend: { month: string; completed: number; score: number }[] = []

export const mockArchiveItems: ArchiveItem[] = []

export const mockTopics: Topic[] = []

export const mockCertifications: { id: string; name: string; date: string; status: string }[] = []

export const mockLearningPath: {
  id: string
  title: string
  resources: string
  duration: string
}[] = []

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
}

export const mockScheduleEvents: ScheduleEvent[] = []

export const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

// ==================== 成绩查看 Mock 数据 ====================

export interface GradeRecord {
  courseId: string
  courseName: string
  teacher: string
  usual: number
  midterm: number
  final: number
  practice: number
  total: number
  status: '已发布' | '录入中' | '已暂存' | '待发布'
}

export interface GradeTrendItem {
  name: string
  usual: number
  midterm: number
  final: number
  total: number
}

export interface CompareItem {
  name: string
  self: number
  avg: number
}

export const mockGradeRecords: GradeRecord[] = []

export const mockGradeTrend: GradeTrendItem[] = []

export const mockCompareData: CompareItem[] = []

// ==================== 学习档案 Mock 数据 ====================

export interface StudyTimeItem {
  label: string
  value: number
  unit: string
}

export interface ActivityItem {
  label: string
  value: string
}

export interface EvaluationItem {
  type: 'system' | 'teacher'
  typeLabel: string
  content: string
  color: string
  bgColor: string
  borderColor: string
}

export const mockStudyTime: StudyTimeItem[] = []

export const mockActivityItems: ActivityItem[] = []

export const mockEvaluations: EvaluationItem[] = []

// ==================== 学生能力画像详情 Mock 数据 ====================

export interface PortraitStudentInfo {
  name: string
  avatar: string
  studentNo: string
  gender: string
  college: string
  major: string
  className: string
  grade: string
  rank: number
  totalStudents: number
  violation: string
  physicalTest: string
  partyStatus: string
}

export interface HonorItem {
  icon: string
  name: string
}

export interface PortraitAcademicSummary {
  label: string
  value: number
  unit: string
}

export interface PortraitRadarData {
  position: string
  values: number[]
}

export interface PortraitScoreOverviewItem {
  label: string
  value: string
  color: 'green' | 'purple' | 'blue' | 'amber'
}

export interface AbilityRow {
  domain: string
  rowspan: number
  abilityPoint: string
  score: number
  studentLevel: string
  studentLevelLabel: string
  requiredLevel: string
  requiredLevelLabel: string
  passed: boolean
}

export interface PortraitJobTab {
  name: string
  scoreOverview: PortraitScoreOverviewItem[]
  abilities: AbilityRow[]
}

export interface RecommendedJob {
  name: string
  match: number
  matchColor?: string
  detail: string
}

export interface CourseScoreItem {
  name: string
  score: number
  level: string
  classRank: string
  attendance: string
}

export interface GraduationDesignItem {
  title: string
  status: string
  statusColor: string
}

export const mockPortraitStudentInfo: PortraitStudentInfo = {
  name: '同学',
  avatar: '?',
  studentNo: '',
  gender: '',
  college: '',
  major: '',
  className: '',
  grade: '',
  rank: 0,
  totalStudents: 0,
  violation: '无',
  physicalTest: '',
  partyStatus: '',
}

export const mockPortraitHonors: HonorItem[] = []

export const mockPortraitAcademicSummaries: PortraitAcademicSummary[] = []

export const mockPortraitRadarData: Record<string, number[]> = {}

export const mockPortraitJobTabs: Record<string, PortraitJobTab> = {}

export const mockPortraitRecommendedJobs: RecommendedJob[] = []

export const mockPortraitRecommendedCompanies: {
  name: string
  match: number
  matchColor?: string
  positions: string[]
}[] = []

export const mockPortraitCourseScores: CourseScoreItem[] = []

export const mockPortraitGraduationDesigns: GraduationDesignItem[] = []
