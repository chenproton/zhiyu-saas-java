// 场景评分详情页共享工具：逐字移植原 React 版
// question-grading-card.tsx（判分逻辑）
// + exam-snapshot.ts（examFromSnapshot）
// + format-utils.ts（computeTotalScore / formatDateTime）
// daily-exam-detail.vue 内联过同一套逻辑；本文件抽出供场景评分链路复用，不回改 daily-exam-detail。

export const QUESTION_TYPE_LABELS_SHORT: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  judge: '判断',
  judgment: '判断',
  fill: '填空',
  fill_blank: '填空',
  essay: '论述',
  short_answer: '简答'
};

export function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS_SHORT[type] || type;
}

export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
  if (typeof v === 'string') return [v.toLowerCase()];
  return [];
}

export function isAnswerCorrect(q: { type?: string; answer?: unknown }, ans: unknown): boolean {
  const correct = toStringArray(q.answer);
  const type = q.type;
  if (type === 'single') {
    const s = typeof ans === 'string' ? ans.toLowerCase() : '';
    return correct.length > 0 && s === correct[0];
  }
  if (type === 'multiple') {
    const given = toStringArray(ans);
    if (given.length !== correct.length) return false;
    const m = new Map<string, number>();
    correct.forEach((c) => m.set(c, (m.get(c) || 0) + 1));
    for (const g of given) {
      const next = (m.get(g) || 0) - 1;
      if (next < 0) return false;
      m.set(g, next);
    }
    return true;
  }
  if (type === 'judge' || type === 'judgment') {
    // 判断题答案归一：兼容 '正确/错误/对/错/T/F/true/false/1/0' 等变体
    const normalize = (v: string): boolean | null => {
      const t = v.trim().toLowerCase();
      if (['正确', '对', 't', 'true', '1', '是'].includes(t)) return true;
      if (['错误', '错', 'f', 'false', '0', '否'].includes(t)) return false;
      return null;
    };
    const s = typeof ans === 'string' ? normalize(ans) : null;
    if (correct.length === 0 || s === null) return false;
    return s === normalize(String(correct[0]));
  }
  return false;
}

export function getAutoScore(q: { type?: string; score?: number; answer?: unknown }, ans: unknown): number {
  const type = q.type;
  if (type === 'single' || type === 'multiple' || type === 'judge' || type === 'judgment') {
    return isAnswerCorrect(q, ans) ? q.score || 0 : 0;
  }
  return 0;
}

export function isAutoQuestion(q: { type?: string }): boolean {
  const type = q.type;
  return type === 'single' || type === 'multiple' || type === 'judge' || type === 'judgment';
}

export function getAnswerLabel(ans: unknown): string {
  if (Array.isArray(ans)) return ans.join('、');
  if (typeof ans === 'string') return ans;
  return '未作答';
}

// ==================== 试卷快照（对齐 React lib/exam-snapshot.ts） ====================

export interface ExamSnapshotQuestion {
  id: string;
  exam_id: string;
  question_id?: string;
  type?: string;
  content: string;
  options?: string[];
  answer?: string | string[];
  analysis?: string;
  score?: number;
  sort_order?: number;
}

export interface ExamSnapshot {
  exam: {
    id: string;
    name: string;
    description?: string;
    status?: string;
    total_score?: number;
    duration?: number;
    version?: string;
  };
  exam_questions: ExamSnapshotQuestion[];
}

export interface ExamQuestionShape {
  id: string;
  questionId: string;
  type: string;
  content: string;
  options?: string[];
  answer: string | string[];
  analysis?: string;
  score: number;
  order: number;
}

export interface ExamShape {
  id: string;
  name: string;
  description?: string;
  status: string;
  totalScore: number;
  duration: number;
  questions: ExamQuestionShape[];
}

// 试卷快照行字段为 snake_case，映射为页面使用的 Exam 形状
export function examFromSnapshot(snap: ExamSnapshot): ExamShape {
  return {
    id: snap.exam.id,
    name: snap.exam.name,
    description: snap.exam.description,
    status: snap.exam.status || 'published',
    totalScore: snap.exam.total_score ?? 0,
    duration: snap.exam.duration ?? 0,
    questions: (snap.exam_questions || []).map(
      (q): ExamQuestionShape => ({
        id: q.id,
        questionId: q.question_id || q.id,
        type: q.type || 'single',
        content: q.content,
        options: q.options,
        answer: q.answer ?? '',
        analysis: q.analysis,
        score: q.score ?? 0,
        order: q.sort_order ?? 0
      })
    )
  };
}

/** 计算展示总分：考试结果分 > 考试总分 > 题目分数求和（对齐 React computeTotalScore） */
export function computeTotalScore(
  examResultTotal: number | undefined,
  examTotal: number | undefined,
  questions: Array<{ score?: number | null }>
): number {
  return examResultTotal ?? examTotal ?? questions.reduce((sum, q) => sum + (q.score ?? 0), 0);
}

export function getInitials(name: string): string {
  if (!name || name === '未知') return '?';
  return name.slice(0, 2).toUpperCase();
}

/** 格式化为 zh-CN 的 YYYY/MM/DD HH:mm，空值/非法值返回 fallback（对齐 React formatDateTime） */
export function formatDateTime(value?: string | Date | null, fallback = '-'): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}
