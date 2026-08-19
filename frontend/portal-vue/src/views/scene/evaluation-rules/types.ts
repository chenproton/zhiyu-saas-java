/**
 * 任务评价规则编辑器（EvaluationRulesEditor）本地类型与常量。
 *
 * 逐项对齐 React `frontend/edu/components/evaluation-rules/`：
 * - types.ts / constants.tsx（EvalPointField / RubricScheme / ScoreRuleItem / 标签与配色）
 * - evaluation-rules-editor.tsx 内部的 ReviewStep / stdDraft 形状
 * EvalRuleConfig 及其子类型复用 `@/views/lesson/lesson-edit-utils`（与 shared-types 一致）。
 */
import { evaluationMethodOptions } from '@/views/partner/co-build-scene-tasks/tasks-logic';
import type { EvalRulePoint, EvalRuleScoreRule, GradeMapping } from '@/views/lesson/lesson-edit-utils';

/** 评价点所属字段（与 React EvalPointField 完全一致） */
export type EvalPointField =
  | 'randomDrawEvalPoints'
  | 'reviewEvalPoints'
  | 'paperEvalPoints'
  | 'questionBankEvalPoints'
  | 'outcomeEvalPoints'
  | 'homeworkEvalPoints'
  | 'quizEvalPoints';

export type StandardNameField =
  | 'randomDrawStandardName'
  | 'reviewStandardName'
  | 'outcomeStandardName'
  | 'homeworkStandardName';

export type StandardModeField =
  | 'randomDrawStandardMode'
  | 'reviewStandardMode'
  | 'outcomeStandardMode'
  | 'homeworkStandardMode';

export type ScoreRulesField =
  | 'randomDrawScoreRules'
  | 'reviewScoreRules'
  | 'outcomeScoreRules'
  | 'homeworkScoreRules';

export const EVAL_POINT_FIELD_BY_METHOD: Record<string, EvalPointField> = {
  random_draw: 'randomDrawEvalPoints',
  review: 'reviewEvalPoints',
  paper: 'paperEvalPoints',
  question_bank: 'questionBankEvalPoints',
  outcome: 'outcomeEvalPoints',
  homework: 'homeworkEvalPoints',
  quiz: 'quizEvalPoints'
};

/** React 中 standardName/standardMode/scoreRules 的三目取值：非四类方法回退 homework* 字段 */
export function standardNameFieldOf(methodKey: string): StandardNameField {
  if (methodKey === 'random_draw') return 'randomDrawStandardName';
  if (methodKey === 'review') return 'reviewStandardName';
  if (methodKey === 'outcome') return 'outcomeStandardName';
  return 'homeworkStandardName';
}

export function standardModeFieldOf(methodKey: string): StandardModeField {
  if (methodKey === 'random_draw') return 'randomDrawStandardMode';
  if (methodKey === 'review') return 'reviewStandardMode';
  if (methodKey === 'outcome') return 'outcomeStandardMode';
  return 'homeworkStandardMode';
}

export function scoreRulesFieldOf(methodKey: string): ScoreRulesField {
  if (methodKey === 'random_draw') return 'randomDrawScoreRules';
  if (methodKey === 'review') return 'reviewScoreRules';
  if (methodKey === 'outcome') return 'outcomeScoreRules';
  return 'homeworkScoreRules';
}

/** 评价标准模板（React RubricScheme） */
export interface ScoreRuleItem {
  id: string;
  name: string;
  desc: string;
  rule: string;
  weight: number;
}

export interface RubricScheme {
  id: string;
  name: string;
  types: string[];
  desc: string;
  points: EvalRulePoint[];
  mode: 'rubric' | 'score_rule';
  scoreRuleItems?: ScoreRuleItem[];
}

/** 评审步骤（编辑器内部形状，携带本地 id；持久化时转 EvalRuleReviewStepInput） */
export interface ReviewStep {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
  subjectType: string;
  assignedUserIds?: string[];
  weight: number;
}

/** 评价标准草稿（名称 + 量规/评分规则） */
export interface StandardDraft {
  name: string;
  mode: 'rubric' | 'score_rule';
}

/** 测评启用条件配置值（ExamActivationConfig 组件契约） */
export interface ExamActivationValue {
  activationMode?: string;
  scheduledTime?: string;
  scheduledEndTime?: string;
}

/** 新建试卷表单数据（ExamFormDialog 组件契约） */
export interface ExamFormData {
  name: string;
  description: string;
  batchId?: string;
  duration: number;
}

/** 评价主体标签：与 React evaluation-rules-editor 内部 subjectLabels 完全一致 */
export const SUBJECT_LABELS: Record<string, string> = {
  teacher: '教师',
  enterprise_mentor: '企业导师',
  self: '自评',
  peer: '互评',
  ai: 'AI 评价',
  service_target: '服务对象'
};

/** 评价主体配置弹窗中展示的主体类型（与 React displayTypes 一致） */
export const SUBJECT_DISPLAY_TYPES = ['teacher', 'enterprise_mentor', 'self', 'peer'] as const;

/** 评价点子类型标签/配色（对齐 React evalSubTypeLabels / evalSubTypeColors） */
export const EVAL_SUB_TYPE_LABELS: Record<string, string> = {
  knowledge_mastery: '知识掌握',
  operation_standard: '操作规范',
  task_completion: '任务完成度',
  result_quality: '成果质量',
  communication: '沟通表达',
  collaboration: '协作能力',
  professionalism: '职业素养',
  innovation: '创新能力',
  adaptability: '应变能力'
};

export const EVAL_SUB_TYPE_COLORS: Record<string, string> = {
  knowledge_mastery: '#409eff',
  operation_standard: '#13c2c2',
  task_completion: '#67c23a',
  result_quality: '#06b6d4',
  communication: '#8b5cf6',
  collaboration: '#f59e0b',
  professionalism: '#e6a23c',
  innovation: '#6366f1',
  adaptability: '#f43f5e'
};

/** 新增等级时的循环配色（对齐 React colors 数组语义） */
export const GRADE_COLORS = ['#67c23a', '#409eff', '#e6a23c', '#f56c6c', '#8b5cf6', '#fb923c'];

/** 题型标签/难度标签（对齐 shared-types QUESTION_TYPE_LABELS_SHORT / DIFFICULTY_LABELS） */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '简答题',
  short_answer: '问答题'
};

export const QUESTION_TYPE_COLORS: Record<string, string> = {
  single: '#409eff',
  multiple: '#8b5cf6',
  judge: '#67c23a',
  fill: '#e6a23c',
  essay: '#13c2c2',
  short_answer: '#f56c6c'
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难'
};

/**
 * 测评方式选项：与 React constants.tsx 一致，仅取平台侧（primaryCategory === 'platform'），
 * 复用 tasks-logic 的唯一数据源（图标/配色/描述）。
 */
export const METHOD_OPTIONS = evaluationMethodOptions.filter((o) => o.primaryCategory === 'platform');

export function methodOptionOf(key: string) {
  return METHOD_OPTIONS.find((o) => o.key === key) || null;
}

export function methodLabelOf(key: string): string {
  return methodOptionOf(key)?.label || key;
}

/** 「自动读取得分」的方法（评价标准由测评资源得分自动生成，不出评价标准配置弹窗） */
export const AUTO_SCORE_METHODS = ['question_bank', 'paper', 'quiz'];

/** 评价方式资源默认配置（与 React getResourceConfig 各处 defaults 对齐） */
export const RESOURCE_DEFAULTS: Record<string, Record<string, any>> = {
  review: {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false
  },
  outcome: {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false
  },
  homework: {
    requiresMaterial: true,
    deadlineDays: 3,
    submitFormatDesc: '',
    venueResources: '',
    allowResubmit: false
  },
  question_bank: {
    drawMode: 'all',
    passRate: 60,
    timeLimit: 30,
    allowRetake: true,
    retakeCount: 3,
    shuffleQuestions: true,
    showResult: true,
    activationMode: 'always',
    scheduledTime: '',
    scheduledEndTime: '',
    questionScores: {}
  },
  quiz: {
    timeLimit: 30,
    allowRetake: true,
    retakeCount: 3,
    shuffleQuestions: true,
    showResult: true,
    activationMode: 'always',
    scheduledTime: '',
    scheduledEndTime: '',
    questionScores: {}
  },
  paper: {
    duration: 60,
    allowRetake: false,
    retakeCount: 1,
    shuffleQuestions: true,
    showResult: true,
    activationMode: 'manual',
    scheduledTime: '',
    scheduledEndTime: ''
  },
  random_draw: {
    drawMode: 'random',
    drawCount: 5,
    submitFormatDesc: '',
    venueResources: ''
  }
};

export type { EvalRulePoint, EvalRuleScoreRule, GradeMapping };
