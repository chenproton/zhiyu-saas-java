// 测评广场（evaluation landing）共享类型与工具。
// 字段对齐 React 侧 frontend/packages/shared-types/src/evaluation-exam.ts（ExamCenterItem）与
// frontend/edu/lib/{cover-gradients,format-utils}.ts；接口契约与 React 完全一致（裸 JSON、{items,total}）。

/** 测评中心条目（landing 考试中心，GET /evaluation/exam-center） */
export interface ExamCenterItem {
  id: string;
  examId: string;
  usageName: string;
  examName: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  status: 'published' | 'in_progress' | 'finished';
  questionCount: number;
  totalScore: number;
  participatable: boolean;
  submitted: boolean;
  score?: number;
  studentView: boolean;
}

/** 卡片默认封面渐变（8 种，对齐 React COVER_GRADIENTS） */
const COVER_GRADIENTS = [
  'linear-gradient(135deg,#7c3aed,#a855f7)',
  'linear-gradient(135deg,#0e7490,#06b6d4)',
  'linear-gradient(135deg,#047857,#10b981)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#b91c1c,#ef4444)',
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#4338ca,#818cf8)'
];

/** 按对象 id 哈希取稳定渐变，同一对象在所有页面颜色一致 */
export function coverGradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
}

/** 格式化为 YYYY-MM-DD，空值/非法值返回 fallback（默认 "-"） */
export function formatDate(value?: string | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 格式化为 YYYY/MM/DD HH:mm（对齐 React formatDateTime），空值返回 fallback */
export function formatDateTime(value?: string | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 难度等级标签与配色（对齐 React DIFFICULTY_LABELS/COLORS） */
export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难'
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444'
};

/** 题型统计图配色（对齐 React bank-detail questionTypeChartColors） */
export const QUESTION_TYPE_CHART_COLORS: Record<string, string> = {
  single: '#3b82f6',
  multiple: '#a855f7',
  judge: '#f59e0b',
  fill: '#10b981',
  essay: '#f43f5e',
  short_answer: '#06b6d4'
};

/** 题型徽标配色（浅色底 + 文字色，对齐 React questionTypeColors） */
export const QUESTION_TYPE_BADGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  single: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  multiple: { bg: '#faf5ff', color: '#9333ea', border: '#e9d5ff' },
  judge: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  fill: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  essay: { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },
  short_answer: { bg: '#ecfeff', color: '#0891b2', border: '#cffafe' }
};

/** 考试中心状态元信息（对齐 React STATUS_META） */
export const EXAM_CENTER_STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  published: { label: '待考', color: '#b45309', dot: '#f59e0b' },
  in_progress: { label: '进行中', color: '#15803d', dot: '#22c55e' },
  finished: { label: '已结束', color: '#64748b', dot: '#94a3b8' }
};

/** 交卷接口（POST /evaluation/exam-results）请求体，对齐 React examResultApi.submit */
export interface ExamSubmitRequest {
  examUsageId: string;
  answers: Record<string, string | string[]>;
  methodKey?: string;
}
