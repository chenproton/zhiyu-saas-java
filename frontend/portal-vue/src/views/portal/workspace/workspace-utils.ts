/**
 * 我的服务台公共工具：学习入口链接、周次导航、状态徽标配色、角色解析。
 *
 * 对齐来源（React）：
 * - frontend/edu/lib/learn-links.ts        → sceneLandingHref / lessonLandingHref / examHref
 * - frontend/edu/lib/schedule-utils.ts     → getWeekStart / getWeekEnd / getWeeksInMonth / getWeekIndex / getWeekTargetDate
 * - frontend/packages/shared-types/src/status.ts → getStatusConfig（仅取工作台用到的状态键）
 * - frontend/edu/lib/active-role.ts        → resolveActiveRole / persistActiveRole（同一 localStorage key）
 * - frontend/edu/app/portal/workspace/_data/workspace-student-types.ts → allPeriods / days
 */

import type { Role } from '@/types/system';

/* ==================== 学习入口链接（资源快照版本化） ==================== */

/** 为链接追加 `?v=` 资源版本；无版本时原样返回（= 最新快照语义） */
export function withResourceVersion(href: string, version?: string | null): string {
  if (!version) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}v=${encodeURIComponent(version)}`;
}

/** 场景详情页 /scene/landing/{id} */
export function sceneLandingHref(scenarioId: string, version?: string | null): string {
  return withResourceVersion(`/scene/landing/${scenarioId}`, version);
}

/** 课程详情页 /lesson/landing/{id} */
export function lessonLandingHref(courseId: string, version?: string | null): string {
  return withResourceVersion(`/lesson/landing/${courseId}`, version);
}

/** 考试作答页 /evaluation/landing/exams/{id}（试卷版本由作答页按 usage 服务端解析，不带 v） */
export function examHref(examId: string, params: Record<string, string | null | undefined>): string {
  const query = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join('&');
  return `/evaluation/landing/exams/${examId}${query ? `?${query}` : ''}`;
}

/* ==================== 周次 / 日期 ==================== */

/** 取 date 所在周的周一（一周从周一开始） */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/** 取 weekStart 所在周的周日（周一 + 6 天） */
export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  return end;
}

/** 某年某月（month 为 1-12）包含的周数，第 1 周为包含当月 1 号的那一周 */
export function getWeeksInMonth(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDay = firstDay.getDay() || 7;
  const totalDays = lastDay.getDate();
  return Math.ceil((totalDays + startDay - 1) / 7);
}

/** weekStart（该周周一）在 year 年 month 月（1-12）中的周次（1-based） */
export function getWeekIndex(weekStart: Date, year: number, month: number): number {
  const firstWeekStart = getWeekStart(new Date(year, month - 1, 1));
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((weekStart.getTime() - firstWeekStart.getTime()) / msPerWeek) + 1;
}

/** 由周次换算回该周周一（与 getWeekIndex 互逆），用于周下拉切换 */
export function getWeekTargetDate(year: number, month: number, targetWeek: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  const startDay = firstDay.getDay() || 7;
  return new Date(year, month - 1, 1 + (targetWeek - 1) * 7 - (startDay - 1));
}

/** YYYY-MM-DD */
export function formatYMD(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 今日中文长日期（对齐 React toLocaleDateString('zh-CN', {年月日周})） */
export function todayLabel(now = new Date()): string {
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${week[now.getDay()]}`;
}

/* ==================== 课表常量 ==================== */

/** 工作台课表节次（对齐 React allPeriods） */
export const ALL_PERIODS = [
  '早自习 1',
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
export const WEEK_DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 月/年视图星期缩写 */
export const WEEK_SHORT_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/* ==================== 状态徽标 ==================== */

export interface StatusConfig {
  label: string;
  color: string;
  bg: string;
}

/** 工作台涉及的状态键（对齐 shared-types/src/status.ts STATUS_MAP 子集） */
const STATUS_MAP: Record<string, StatusConfig> = {
  draft: { label: '草稿', color: '#64748b', bg: '#f1f5f9' },
  pending: { label: '审核中', color: '#2563eb', bg: '#dbeafe' },
  approved: { label: '已通过', color: '#7c3aed', bg: '#ede9fe' },
  rejected: { label: '已驳回', color: '#dc2626', bg: '#fee2e2' },
  published: { label: '已发布', color: '#16a34a', bg: '#dcfce7' },
  archived: { label: '已归档', color: '#8f959e', bg: '#f5f6f7' },
  未开始: { label: '未开始', color: '#4b5563', bg: '#f3f4f6' },
  进行中: { label: '进行中', color: '#2563eb', bg: '#eff6ff' },
  待提交: { label: '待提交', color: '#d97706', bg: '#fef3c7' },
  已批改: { label: '已批改', color: '#7c3aed', bg: '#ede9fe' },
  已完成: { label: '已完成', color: '#16a34a', bg: '#dcfce7' },
  待考: { label: '待考', color: '#d97706', bg: '#fef3c7' },
  已结课: { label: '已结课', color: '#16a34a', bg: '#dcfce7' }
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status] || { label: status, color: '#64748b', bg: '#f1f5f9' };
}

/** 中文难度标签 → 文字色（对齐 React DIFFICULTY_LABELS/COLORS 派生映射） */
export const DIFFICULTY_TEXT_COLORS: Record<string, string> = {
  简单: '#22c55e',
  中等: '#f59e0b',
  困难: '#ef4444'
};

/* ==================== 角色解析（与 React 同一存储 key） ==================== */

const ROLE_PRIORITY = ['school_admin', 'teacher', 'student', 'enterprise_mentor'];
const ROLE_STORAGE_PREFIX = 'zhiyu-active-role:';

function pickDefaultRole(roles?: Role[]): Role | undefined {
  if (!roles || roles.length === 0) return undefined;
  for (const code of ROLE_PRIORITY) {
    const found = roles.find((r) => r.code === code);
    if (found) return found;
  }
  return roles[0];
}

export function resolveActiveRole(userId?: string, roles?: Role[]): Role | undefined {
  if (!roles || roles.length === 0) return undefined;
  if (userId && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(ROLE_STORAGE_PREFIX + userId);
      if (saved) {
        const found = roles.find((r) => r.id === saved);
        if (found) return found;
      }
    } catch {
      // 忽略存储异常
    }
  }
  return pickDefaultRole(roles);
}

export function persistActiveRole(userId: string, roleId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROLE_STORAGE_PREFIX + userId, roleId);
  } catch {
    // 忽略存储异常
  }
}
