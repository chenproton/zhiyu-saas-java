/**
 * 教师工作台类型定义与占位数据。
 *
 * 对齐来源（原 React 版）：workspace-teacher-types.ts
 * —— React 侧该文件的教学跟踪 / 测评管理 / 期末总评 / 账号安全条目数据「已清空为默认值/空数组」，
 * 仅用于撑起页面结构，等接入真实接口后再填充。Vue 侧同样保持空值，保证与 React 展示一致
 * （不自造假数据；接入真实接口时两侧同步改）。
 *
 * 外部平台地址对齐原 React 版 external-links.ts 的 SCENE_PLATFORM_URL
 * （门户未收录 external-links，这里按同一环境变量 + 同一兜底地址取值）。
 */

/* ==================== 备课关联 ==================== */

export interface PrepSubItem {
  id: string;
  name: string;
}

export interface PrepAssociationRecord {
  planId: string;
  subItems: PrepSubItem[];
}

/** 混合课程「节次」候选（React 侧为空对象，等真实接口） */
export const hybridCourseSessions: Record<string, PrepSubItem[]> = {};

/** 实践场景「任务」候选（React 侧为空对象，等真实接口） */
export const scenarioTasks: Record<string, PrepSubItem[]> = {};

/* ==================== 弹窗 / 气泡交互上下文 ==================== */

/** 课程数据弹窗（教学进展/测评进展/期末总评）的目标课程 */
export interface CourseDetailTarget {
  id: string;
  name: string;
  className: string;
  students: number;
}

export type CourseDetailTab = 'tracking' | 'assessment' | 'final';

/** 课表格位（或节次卡）气泡操作所需上下文（对齐 React 内联算出的 pid / sessionKey / urls） */
export interface CellMeta {
  planId: string;
  sessionKey: string;
  isHybrid: boolean;
  prepUrl: string;
  learnUrl: string;
}

/** 「前往备课 / 导学准备」请求 */
export interface PrepRequest {
  planId: string;
  sessionKey: string;
  planName: string;
  isHybrid: boolean;
  prepUrl: string;
}

/** 「前往评分」→ 混合课考勤评分弹窗请求 */
export interface HybridGradeRequest {
  title: string;
  className: string;
  courseId?: string;
}

/* ==================== 外部平台 / 备课入口 ==================== */

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** 实践场景平台（场景资源、学生/教师学习页、评分页） */
export const SCENE_PLATFORM_URL = env.VITE_SCENE_PLATFORM_URL || 'http://111.170.170.202:3003';

/** 混合课备课页（站内路由） */
export const HYBRID_PREP_URL = '/lesson/admin/hybrid/add?id=hybrid-1';

/** 场景导学准备页（场景平台外链） */
export const SCENE_PREP_URL = `${SCENE_PLATFORM_URL}/student_teacher.html?task=task-1-1`;

/* ==================== 教学跟踪（节次教学进展） ==================== */

export const signInData = { total: 0, present: 0, late: 0, absent: 0, rate: 0 };

export const signInDaily: { date: string; present: number; late: number; absent: number }[] = [];

export const quizResults: {
  id: string;
  name: string;
  avgScore: number;
  passRate: number;
  count: number;
  maxScore: number;
}[] = [];

export const rushAnswerRanking: {
  rank: number;
  name: string;
  correctCount: number;
  avgTime: string;
  badge: string;
}[] = [];

export const classInteraction: { name: string; active: number; total: number }[] = [];

export const attendanceRateData: { name: string; rate: number }[] = [];

export const studentDetails: {
  name: string;
  attendance: number;
  quizAvg: number;
  interaction: number;
  praise: number;
  grade: string;
}[] = [];

/** 课堂互动次数：React 侧为写死展示值（占位），此处保持一致 */
export const CLASS_INTERACTION_COUNT = 28;

/* ==================== 测评管理（节次测评进展） ==================== */

export const homeworkSubmissions: {
  id: string;
  name: string;
  deadline: string;
  submitRate: number;
  avgScore: number;
  total: number;
}[] = [];

export const homeworkTrend: { week: string; rate: number }[] = [];

export const peerReviewStats = {
  totalGroups: 0,
  avgPeerScore: 0,
  completionRate: 0,
  steps: [] as { name: string; weight: number; avgScore: number }[]
};

export const trainingReports: {
  name: string;
  submitted: number;
  total: number;
  rate: number;
  avgScore: number;
  rating: string;
}[] = [];

/* ==================== 期末总评（课程教学进展分析） ==================== */

export const semesterSummary = {
  totalSessions: 0,
  avgAttendance: 0,
  compositeAvgScore: 0,
  totalStudents: 0,
  dataCollectionRate: 0,
  needAttention: 0
};

export const assessmentDimensions: {
  id: string;
  name: string;
  category: string;
  weight: number;
  avgScore: number;
  status: string;
  sessions: number;
}[] = [];

export const compositeDistribution: { range: string; count: number }[] = [];

export const studentRanking: {
  rank: number;
  name: string;
  attendance: number;
  inClassQuiz: number;
  homework: number;
  peerReview: number;
  report: number;
  total: number;
  grade: string;
}[] = [];

/** 综合等级 → 徽标配色（对齐 React gradeColorMap） */
export const GRADE_COLOR_MAP: Record<string, { color: string; bg: string }> = {
  A: { color: '#047857', bg: '#d1fae5' },
  B: { color: '#2563eb', bg: '#dbeafe' },
  C: { color: '#b45309', bg: '#fef3c7' },
  D: { color: '#b91c1c', bg: '#fee2e2' },
  E: { color: '#374151', bg: '#f3f4f6' }
};

/* ==================== 教师个人中心 ==================== */

/** 账号安全条目（React 侧为空数组，等真实接口） */
export const teacherSecurityItems: {
  label: string;
  status: string;
  statusText: string;
  action: string;
}[] = [];

/* ==================== 课表常量（教师课表与学生课表节次不同） ==================== */

/** 教师课程日历节次（对齐 React teacher-dashboard-tab allPeriods，无「早自习」） */
export const TEACHER_PERIODS = [
  '上午 1',
  '上午 2',
  '上午 3',
  '上午 4',
  '下午 1',
  '下午 2',
  '下午 3',
  '下午 4',
  '晚自习 1'
];

/** 星期表头（对齐 React days） */
export const TEACHER_WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 课表事件类型 → 配色 / 标签（对齐 React scheduleTypeConfig） */
export interface ScheduleTypeStyle {
  bg: string;
  border: string;
  badge: string;
  label: string;
}

export const SCHEDULE_TYPE_CONFIG: Record<string, ScheduleTypeStyle> = {
  course: { bg: '#eff6ff', border: '#bfdbfe', badge: '#2563eb', label: '课程' },
  scene: { bg: '#ecfdf5', border: '#a7f3d0', badge: '#059669', label: '实践场景' },
  meeting: { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', label: '会议' },
  training: { bg: '#ecfeff', border: '#a5f3fc', badge: '#0891b2', label: '培训' },
  exam: { bg: '#f5f3ff', border: '#ddd6fe', badge: '#7c3aed', label: '考试' },
  todo: { bg: '#f9fafb', border: '#e5e7eb', badge: '#4b5563', label: '待办' }
};
