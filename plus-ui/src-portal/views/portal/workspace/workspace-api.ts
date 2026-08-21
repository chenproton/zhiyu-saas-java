/**
 * 我的服务台（工作台）数据契约与端点直连。
 *
 * 对齐来源（React）：
 * - 原 React 版 api-client 的 api/portal.ts  → portalApi.workspaceDashboard / portalMeApi
 * - 原 React 版 api-client 的 api/honors.ts  → studentHonorApi
 * - 原 React 版 api-client 的 api/affairs.ts → myScheduleApi
 * - 原 React 版 shared-types 的 portal.ts    → Workspace* / StudentHonor 类型
 *
 * 说明：src/api/*.ts 尚未收录以上工作台端点，按任务约定不改 api/*.ts，
 * 这里用同一 request()/portalRequest() 直连相同后端路径（Java 后端 /api/v1 已注册）。
 */

import { request, portalRequest, buildQuery } from '@/api/http';
import type { ListResponse } from '@/api/http';
import type { AffairsTerm, ScheduleEntry } from '@/types/affairs';
import type { Role, Organization, Major } from '@/types/system';
import type { User } from '@/types/user';

/* ==================== 工作台仪表盘类型（对齐 shared-types/portal.ts） ==================== */

export interface WorkspaceAnnouncement {
  id: string;
  title: string;
  type: string;
  isNew: boolean;
  date: string;
}

export interface WorkspaceTodo {
  id: string;
  title: string;
  type: string;
  count: number;
  urgent: boolean;
  deadline?: string;
}

export type WorkspaceScheduleEventType = 'course' | 'scene' | 'exam' | 'todo';

export interface WorkspaceScheduleEvent {
  id: string;
  title: string;
  type: WorkspaceScheduleEventType;
  dayOfWeek: number;
  period: string;
  teacher?: string;
  location?: string;
  status?: string;
  className?: string;
  tag?: string;
  description?: string;
  scenarioId?: string;
  courseId?: string;
  /** 排课 stamp 的资源版本（考试事件为 examVersion），前端拼 ?v= 用 */
  resourceVersion?: string;
  /** 单次安排的日期（YYYY-MM-DD…）；缺省视为每周重复 */
  date?: string;
}

export interface WorkspaceStats {
  label1: string;
  value1: number;
  label2: string;
  value2: number;
}

/** 学校管理员：资源存量入口卡（icon 为后端下发的图标 key，href 为跳转路径） */
export interface WorkspaceResourceStat {
  label: string;
  value: number;
  icon?: string;
  href?: string;
}

/** 学校管理员：人员概览（学生/教职工/企业导师/学校管理员计数） */
export interface WorkspacePersonnelStat {
  label: string;
  value: number;
}

/** 学校管理员：资源增长趋势（按日聚合各资源新增数） */
export interface WorkspaceResourceGrowth {
  date: string;
  courses: number;
  scenarios: number;
  careerPositions: number;
  questionBanks: number;
  exams: number;
  examUsages: number;
}

/** 教师：开课计划（班级 × 课程/场景） */
export interface WorkspaceClassPlan {
  id: string;
  name: string;
  course: string;
  term: string;
  students: number;
  teacher: string;
  status: 'pending' | 'active';
  scenarioId?: string;
  courseId?: string;
}

/** 教师：开课计划下的节次（周次/星期/节次/场地） */
export interface WorkspaceClassSession {
  id: string;
  courseId: string;
  venue: string;
  week: number;
  weekday: string;
  period: string;
  status: 'pending' | 'associated';
}

export interface WorkspaceCourse {
  id: string;
  code: string;
  name: string;
  type: string;
  teacher: string;
  credit: number;
  hours: number;
  progress: number;
  cover: string;
  status: '进行中' | '未开始' | '已完成';
  nextTask?: string;
  nextDeadline?: string;
  resourceVersion?: string;
}

export interface WorkspaceSceneTask {
  id: string;
  scenarioId: string;
  sceneName: string;
  taskName: string;
  position: string;
  abilityTags: string[];
  status: '未开始' | '进行中' | '待提交' | '已批改' | '已完成';
  deadline: string;
  score?: number;
  totalScore: number;
  difficulty: '简单' | '中等' | '困难';
  resourceVersion?: string;
}

export interface WorkspaceExam {
  id: string;
  examId: string;
  name: string;
  type: '随堂测' | '单元测试' | '在线测评' | '岗位能力认定';
  status: '待考' | '进行中' | '已完成';
  startTime: string;
  endTime: string;
  duration: number;
  score?: number;
  totalScore: number;
}

export interface WorkspaceLearningPath {
  id: string;
  title: string;
  resources: string;
  duration: string;
}

export interface WorkspaceDashboard {
  role: string;
  announcements: WorkspaceAnnouncement[];
  todos: WorkspaceTodo[];
  schedule: WorkspaceScheduleEvent[];
  stats?: WorkspaceStats;
  /** 学校管理员专属聚合（其余角色后端不下发） */
  resourceStats?: WorkspaceResourceStat[];
  personnelStats?: WorkspacePersonnelStat[];
  resourceGrowth?: WorkspaceResourceGrowth[];
  courses: WorkspaceCourse[];
  sceneTasks: WorkspaceSceneTask[];
  exams: WorkspaceExam[];
  learningPath: WorkspaceLearningPath[];
  /** 教师专属聚合（学生角色后端不下发） */
  classPlans?: WorkspaceClassPlan[];
  classSessions?: WorkspaceClassSession[];
}

/* ==================== 学生荣誉 ==================== */

export interface StudentHonor {
  id: string;
  name: string;
  issuer: string;
  honorDate: string;
  fileName?: string;
  fileUrl?: string;
}

export interface StudentHonorPayload {
  name: string;
  issuer?: string;
  honorDate?: string;
  fileName?: string;
  fileUrl?: string;
}

/* ==================== 我的课表 ==================== */

export interface MyScheduleResponse {
  term: AffairsTerm;
  viewAs: string;
  items: ScheduleEntry[];
  total: number;
}

/* ==================== 登录态（角色/班级/专业/机构） ==================== */

export interface PortalInstitution {
  id: string;
  name: string;
  type?: string;
}

export interface PortalMeResponse {
  user: User;
  institution?: PortalInstitution;
  tenant?: { id: string; name: string };
  orgNode?: Organization;
  major?: Major;
  roles?: Role[];
}

/* ==================== 端点 ==================== */

/** 工作台仪表盘（GET /portal/workspace/dashboard?role=） */
export const workspaceDashboardApi = {
  get: (params?: { role?: string }) =>
    request<WorkspaceDashboard>(`/portal/workspace/dashboard${buildQuery(params || {})}`)
};

/** 我的课表（GET /portal/workspace/my-schedule?termId=；termId 缺省取当前学期） */
export const myScheduleApi = {
  get: (termId?: string) =>
    request<MyScheduleResponse>(`/portal/workspace/my-schedule${buildQuery({ termId })}`)
};

/** 学生荣誉奖励（/portal/workspace/honors） */
export const studentHonorApi = {
  list: (params?: { userId?: string }) =>
    request<ListResponse<StudentHonor>>(`/portal/workspace/honors${buildQuery(params || {})}`),
  create: (req: StudentHonorPayload) =>
    request<{ id: string }>('/portal/workspace/honors', {
      method: 'POST',
      body: JSON.stringify(req)
    }),
  update: (id: string, req: StudentHonorPayload) =>
    request<{ id: string }>(`/portal/workspace/honors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(req)
    }),
  remove: (id: string) =>
    request<{ id: string }>(`/portal/workspace/honors/${id}`, { method: 'DELETE' })
};

/** 个人中心：本人姓名 / 密码 / 登录态明细 */
export const portalMeApi = {
  me: () => request<PortalMeResponse>('/auth/portal/me'),
  updateName: (name: string) =>
    portalRequest<User>('/portal/workspace/me', {
      method: 'PUT',
      body: JSON.stringify({ name })
    }),
  changePassword: (newPassword: string) =>
    portalRequest<{ id: string }>('/portal/workspace/me/password', {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    })
};
