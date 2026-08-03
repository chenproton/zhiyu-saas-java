export interface WorkspaceAnnouncement {
  id: string
  title: string
  type: string
  isNew: boolean
  date: string
}

export interface WorkspaceTodo {
  id: string
  title: string
  type: string
  count: number
  urgent: boolean
  deadline?: string
}

export interface WorkspaceScheduleEvent {
  id: string
  title: string
  type: 'course' | 'scene' | 'exam' | 'todo'
  dayOfWeek: number
  period: string
  teacher?: string
  location?: string
  status?: string
  className?: string
  tag?: string
  description?: string
  scenarioId?: string
  courseId?: string
}

export interface WorkspaceStats {
  label1: string
  value1: number
  label2: string
  value2: number
}

export interface WorkspaceResourceStat {
  label: string
  value: number
  icon?: string
  href?: string
}

export interface WorkspacePersonnelStat {
  label: string
  value: number
}

export interface WorkspaceResourceGrowth {
  month: string
  courses: number
  scenarios: number
  careerPositions: number
  questionBanks: number
  exams: number
  examUsages: number
}

export interface WorkspaceCourse {
  id: string
  code: string
  name: string
  type: string
  teacher: string
  credit: number
  hours: number
  progress: number
  cover: string
  status: '进行中' | '未开始' | '已完成'
  nextTask?: string
  nextDeadline?: string
}

export interface WorkspaceSceneTask {
  id: string
  scenarioId: string
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

export interface WorkspaceExam {
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

export interface WorkspaceLearningPath {
  id: string
  title: string
  resources: string
  duration: string
}

export interface WorkspaceTeacherCourse {
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

export interface WorkspaceClassPlan {
  id: string
  name: string
  course: string
  term: string
  students: number
  teacher: string
  status: 'pending' | 'active'
  scenarioId?: string
  courseId?: string
}

export interface WorkspaceClassSession {
  id: string
  courseId: string
  venue: string
  week: number
  weekday: string
  period: string
  status: 'pending' | 'associated'
}

export interface WorkspaceDashboard {
  role: string
  announcements: WorkspaceAnnouncement[]
  todos: WorkspaceTodo[]
  schedule: WorkspaceScheduleEvent[]
  stats?: WorkspaceStats
  resourceStats?: WorkspaceResourceStat[]
  personnelStats?: WorkspacePersonnelStat[]
  resourceGrowth?: WorkspaceResourceGrowth[]
  courses: WorkspaceCourse[]
  sceneTasks: WorkspaceSceneTask[]
  exams: WorkspaceExam[]
  learningPath: WorkspaceLearningPath[]
  teacherCourses: WorkspaceTeacherCourse[]
  classPlans: WorkspaceClassPlan[]
  classSessions: WorkspaceClassSession[]
}
