// 场景共建任务链编辑页的纯类型与纯函数（对齐 React
// frontend/edu/app/partner/co-build/scenes/[id]/edit/tasks/page.tsx 及其复用的
// tasks-logic.tsx / shared-types/evaluation-rules.ts）。
// 本文件只含类型与纯函数，不发起任何请求；EvalRuleConfig 等统一契约复用 lesson-edit-utils.ts。
import {
  clone,
  uid,
  DEFAULT_EVAL_RULE_GRADE_MAPPING,
  DEFAULT_EVAL_RULE_SUBJECTS,
  type EvalRuleConfig,
  type EvalRuleMethodKey,
  type EvalRulePoint,
  type EvalRuleScoreRule,
  type EvalRuleSubjectConfig,
  type EvalRuleReviewStepInput,
  type GradeMapping,
  type EvalObjectType,
  type EvalScoreType,
  type EvalStandardMode
} from '@/views/lesson/lesson-edit-utils';

/* ============ 卡片类型与配置 ============ */

export type CardType =
  | 'info'
  | 'description'
  | 'knowledge'
  | 'ability'
  | 'resources'
  | 'evaluation'
  | 'evaluationRules'
  | 'weight';

export interface CardConfig {
  type: CardType;
  title: string;
  /** Element Plus 图标组件名（全局注册，模板中 :is 引用） */
  icon: string;
}

export const cardConfigs: CardConfig[] = [
  { type: 'info', title: '配置任务基础信息', icon: 'Document' },
  { type: 'description', title: '配置任务说明', icon: 'Notebook' },
  { type: 'knowledge', title: '考查知识点', icon: 'Reading' },
  { type: 'ability', title: '考查能力点', icon: 'Medal' },
  { type: 'resources', title: '配置任务资源', icon: 'Link' },
  { type: 'evaluation', title: '配置任务测评形式', icon: 'CircleCheckFilled' },
  { type: 'evaluationRules', title: '配置任务评价规则', icon: 'Stamp' },
  { type: 'weight', title: '配置任务权重', icon: 'ScaleToOriginal' }
];

/* ============ 测评方式选项（对齐 EVALUATION_METHOD_OPTIONS） ============ */

export interface EvaluationMethodOption {
  key: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  colorBg: string;
  available: boolean;
  primaryCategory: 'platform' | 'industry';
  secondaryCategory: string;
}

export const evaluationMethodOptions: EvaluationMethodOption[] = [
  { key: 'question_bank', label: '题库', desc: '从题库选题组成测评资源', icon: 'Collection', color: '#e6a23c', colorBg: '#fdf6ec', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'paper', label: '试卷', desc: '使用固定试卷进行考核', icon: 'Tickets', color: '#67c23a', colorBg: '#f0f9eb', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'quiz', label: '随堂测', desc: '课堂即时测验', icon: 'EditPen', color: '#f56c6c', colorBg: '#fef0f0', available: true, primaryCategory: 'platform', secondaryCategory: '知识评价' },
  { key: 'random_draw', label: '现场问答', desc: '从题库抽取题目，教师现场提问', icon: 'ChatLineRound', color: '#409eff', colorBg: '#ecf5ff', available: true, primaryCategory: 'platform', secondaryCategory: '过程评价' },
  { key: 'review', label: '现场评审', desc: '教师根据表现/材料给评价点打分', icon: 'Stamp', color: '#9c27b0', colorBg: '#f5eef9', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'outcome', label: '成果评价', desc: '对学生成果进行评价', icon: 'FolderChecked', color: '#13c2c2', colorBg: '#e6fffb', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'homework', label: '作业', desc: '学生提交作业进行评价', icon: 'Notebook', color: '#eb2f96', colorBg: '#fff0f6', available: true, primaryCategory: 'platform', secondaryCategory: '成果评价' },
  { key: 'wms_inbound', label: 'WMS(入库单)自动化评分', desc: '基于 WMS 入库单操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_outbound', label: 'WMS(出库单)自动化评分', desc: '基于 WMS 出库单操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'wms_wave', label: 'WMS(波次分拣)自动化评分', desc: '基于 WMS 波次分拣操作的自动化评分', icon: 'Box', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '智慧物流' },
  { key: 'network_traffic', label: '网络流量分析自助评价', desc: '基于网络流量分析的自助评价', icon: 'Odometer', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '网络安全' },
  { key: 'cyber_range', label: '网络靶场自助评价', desc: '基于网络靶场环境的自助评价', icon: 'Odometer', color: '#5b6b8c', colorBg: '#f0f2f7', available: false, primaryCategory: 'industry', secondaryCategory: '网络安全' }
];

export function evaluationMethodLabel(key: string): string {
  return evaluationMethodOptions.find((o) => o.key === key)?.label || key;
}

export const defaultGradeMapping: GradeMapping[] = clone(DEFAULT_EVAL_RULE_GRADE_MAPPING);

/* ============ 评价点 / 任务状态 ============ */

export type EvalSubType = string;

export interface EvalPoint {
  id: string;
  name: string;
  desc: string;
  subType?: EvalSubType;
  types?: EvalSubType[];
  knowledgePointIds?: string[];
  abilityPointIds?: string[];
  scoringMethod?: 'score' | 'level' | 'rubric';
  gradeMapping?: GradeMapping[];
  weight?: number;
}

export interface ScoringConfig {
  teacherBackground: string;
  scorerCount: number;
  requiresEnterpriseMentor: boolean;
}

export interface TaskState {
  description: string;
  descriptionPdf: string | null;
  knowledgePoints: string[];
  knowledgeAutoResources: string[];
  abilityPoints: string[];
  abilityLevelMappings: { abilityId: string; level: number }[];
  resources: string[];
  evaluationMethods: string[];
  disabledEvaluationMethods: string[];
  randomDrawQuestions: string[];
  randomDrawCustomQuestions: {
    id: string;
    name: string;
    description: string;
    answer: string;
    majorId: string;
  }[];
  randomDrawSelectedIds: string[];
  randomDrawEvalPoints: EvalPoint[];
  randomDrawScoreType: 'eval_points' | 'ability_levels';
  randomDrawRubricId: string | null;
  randomDrawStandardName?: string;
  randomDrawStandardMode?: 'rubric' | 'score_rule';
  randomDrawScoreRules?: EvalRuleScoreRule[];
  reviewEvalPoints: EvalPoint[];
  reviewScoreType: 'eval_points' | 'ability_levels';
  reviewRubricId: string | null;
  reviewStandardName?: string;
  reviewStandardMode?: 'rubric' | 'score_rule';
  reviewScoreRules?: EvalRuleScoreRule[];
  paperIds: string[];
  paperWeights: Record<string, number>;
  paperEvalPoints: EvalPoint[];
  questionBankQuestions: string[];
  questionBankEvalPoints: EvalPoint[];
  outcomeEvalPoints: EvalPoint[];
  outcomeScoreType: 'eval_points' | 'ability_levels';
  outcomeRubricId: string | null;
  outcomeStandardName?: string;
  outcomeStandardMode?: 'rubric' | 'score_rule';
  outcomeScoreRules?: EvalRuleScoreRule[];
  homeworkEvalPoints: EvalPoint[];
  homeworkScoreType: 'eval_points' | 'ability_levels';
  homeworkRubricId: string | null;
  homeworkStandardName?: string;
  homeworkStandardMode?: 'rubric' | 'score_rule';
  homeworkScoreRules?: EvalRuleScoreRule[];
  quizQuestions: string[];
  quizEvalPoints: EvalPoint[];
  weight: number;
  locked: boolean;
  gradeMapping: GradeMapping[];
  scoringConfig: ScoringConfig;
  evalObject: EvalObjectType;
  evalSubjects: EvalRuleSubjectConfig[];
  methodEvalObjects: Record<string, EvalObjectType>;
  methodEvalSubjects: Record<string, EvalRuleSubjectConfig[]>;
  methodWeights: Record<string, number>;
  evalMethodConfigs: Record<string, any>;
  reviewSteps: any[];
  methodResourceConfigs: Record<string, any>;
  evalMethodVersion: number;
}

/* ============ TaskState <-> EvalRuleConfig 转换（对齐 tasks-logic.tsx） ============ */

function normalizeMethod(m: string): string {
  return m === 'exam' ? 'homework' : m;
}

function normalizeMap<T>(record: Record<string, T>): Record<string, T> {
  const next: Record<string, T> = {};
  Object.entries(record || {}).forEach(([k, v]) => {
    next[normalizeMethod(k)] = v;
  });
  return next;
}

export function taskStateToEvalRuleConfig(state: TaskState): EvalRuleConfig {
  return {
    evaluationMethods: state.evaluationMethods.map(normalizeMethod) as EvalRuleMethodKey[],
    disabledEvaluationMethods: (state.disabledEvaluationMethods || []).map(
      normalizeMethod
    ) as EvalRuleMethodKey[],
    methodWeights: normalizeMap(state.methodWeights || {}),
    evalObject: state.evalObject,
    methodEvalObjects: normalizeMap(state.methodEvalObjects || {}),
    evalSubjects: state.evalSubjects,
    methodEvalSubjects: normalizeMap(state.methodEvalSubjects || {}),
    randomDrawQuestions: state.randomDrawQuestions,
    randomDrawCustomQuestions: state.randomDrawCustomQuestions,
    randomDrawSelectedIds: state.randomDrawSelectedIds,
    randomDrawEvalPoints: state.randomDrawEvalPoints as EvalRulePoint[],
    randomDrawScoreType: state.randomDrawScoreType,
    randomDrawRubricId: state.randomDrawRubricId,
    randomDrawStandardName: state.randomDrawStandardName,
    randomDrawStandardMode: state.randomDrawStandardMode,
    randomDrawScoreRules: state.randomDrawScoreRules,
    reviewEvalPoints: state.reviewEvalPoints as EvalRulePoint[],
    reviewScoreType: state.reviewScoreType,
    reviewRubricId: state.reviewRubricId,
    reviewStandardName: state.reviewStandardName,
    reviewStandardMode: state.reviewStandardMode,
    reviewScoreRules: state.reviewScoreRules,
    paperIds: state.paperIds,
    paperWeights: state.paperWeights,
    paperEvalPoints: state.paperEvalPoints as EvalRulePoint[],
    questionBankQuestions: state.questionBankQuestions,
    questionBankEvalPoints: state.questionBankEvalPoints as EvalRulePoint[],
    outcomeEvalPoints: state.outcomeEvalPoints as EvalRulePoint[],
    outcomeScoreType: state.outcomeScoreType,
    outcomeRubricId: state.outcomeRubricId,
    outcomeStandardName: state.outcomeStandardName,
    outcomeStandardMode: state.outcomeStandardMode,
    outcomeScoreRules: state.outcomeScoreRules,
    homeworkEvalPoints: state.homeworkEvalPoints as EvalRulePoint[],
    homeworkScoreType: state.homeworkScoreType,
    homeworkRubricId: state.homeworkRubricId,
    homeworkStandardName: state.homeworkStandardName,
    homeworkStandardMode: state.homeworkStandardMode,
    homeworkScoreRules: state.homeworkScoreRules,
    quizQuestions: state.quizQuestions,
    quizEvalPoints: state.quizEvalPoints as EvalRulePoint[],
    gradeMapping: state.gradeMapping,
    methodResourceConfigs: normalizeMap(state.methodResourceConfigs || {}),
    reviewSteps: (state.reviewSteps || []).map((rs: any, i: number) => ({
      ...(rs.id ? { id: rs.id } : {}),
      label: rs.label,
      description: rs.desc || null,
      enabled: rs.enabled,
      subjectType: rs.subjectType || null,
      assignedUserIds: rs.assignedUserIds || [],
      weight: rs.weight,
      sortOrder: i
    }))
  };
}

export function evalRuleConfigToTaskStateUpdates(config: EvalRuleConfig): Partial<TaskState> {
  return {
    evaluationMethods: config.evaluationMethods.map(normalizeMethod),
    disabledEvaluationMethods: (config.disabledEvaluationMethods || []).map(normalizeMethod),
    methodWeights: normalizeMap(config.methodWeights || {}),
    evalObject: config.evalObject,
    methodEvalObjects: normalizeMap(config.methodEvalObjects || {}),
    evalSubjects: config.evalSubjects as EvalRuleSubjectConfig[],
    methodEvalSubjects: normalizeMap(config.methodEvalSubjects || {}) as Record<
      string,
      EvalRuleSubjectConfig[]
    >,
    randomDrawQuestions: config.randomDrawQuestions,
    randomDrawCustomQuestions: config.randomDrawCustomQuestions,
    randomDrawSelectedIds: config.randomDrawSelectedIds,
    randomDrawEvalPoints: config.randomDrawEvalPoints as EvalPoint[],
    randomDrawScoreType: config.randomDrawScoreType,
    randomDrawRubricId: config.randomDrawRubricId,
    randomDrawStandardName: config.randomDrawStandardName,
    randomDrawStandardMode: config.randomDrawStandardMode,
    randomDrawScoreRules: config.randomDrawScoreRules,
    reviewEvalPoints: config.reviewEvalPoints as EvalPoint[],
    reviewScoreType: config.reviewScoreType,
    reviewRubricId: config.reviewRubricId,
    reviewStandardName: config.reviewStandardName,
    reviewStandardMode: config.reviewStandardMode,
    reviewScoreRules: config.reviewScoreRules,
    paperIds: config.paperIds,
    paperWeights: config.paperWeights,
    paperEvalPoints: config.paperEvalPoints as EvalPoint[],
    questionBankQuestions: config.questionBankQuestions,
    questionBankEvalPoints: config.questionBankEvalPoints as EvalPoint[],
    outcomeEvalPoints: config.outcomeEvalPoints as EvalPoint[],
    outcomeScoreType: config.outcomeScoreType,
    outcomeRubricId: config.outcomeRubricId,
    outcomeStandardName: config.outcomeStandardName,
    outcomeStandardMode: config.outcomeStandardMode,
    outcomeScoreRules: config.outcomeScoreRules,
    homeworkEvalPoints: config.homeworkEvalPoints as EvalPoint[],
    homeworkScoreType: config.homeworkScoreType,
    homeworkRubricId: config.homeworkRubricId,
    homeworkStandardName: config.homeworkStandardName,
    homeworkStandardMode: config.homeworkStandardMode,
    homeworkScoreRules: config.homeworkScoreRules,
    quizQuestions: config.quizQuestions,
    quizEvalPoints: config.quizEvalPoints as EvalPoint[],
    gradeMapping: config.gradeMapping,
    methodResourceConfigs: normalizeMap(config.methodResourceConfigs || {}),
    reviewSteps: (config.reviewSteps || []).map((rs: EvalRuleReviewStepInput) => ({
      id: (rs as { id?: string }).id || uid('rs'),
      label: rs.label,
      desc: rs.description || '',
      enabled: rs.enabled,
      subjectType: rs.subjectType || '',
      assignedUserIds: rs.assignedUserIds || [],
      weight: rs.weight
    }))
  };
}

/* ============ 测评方式 <-> EvalRuleConfig（对齐 shared-types/evaluation-rules.ts 严格版） ============ */

export interface TaskEvaluationMethod {
  methodKey: string;
  weight: number;
  version?: number;
  evalObject?: string;
  scoreType?: string | null;
  evalSubjects?: EvalRuleSubjectConfig[];
  rubricTemplateId?: string | null;
  standardName?: string | null;
  standardMode?: string | null;
  resourceConfig?: Record<string, any>;
  isEnabled?: boolean;
  evalPoints?: Array<{
    id: string;
    name: string;
    description?: string | null;
    subType?: string | null;
    types?: string[];
    weight: number;
    scoringMethod: string;
    gradeMapping?: GradeMapping[];
    knowledgePointIds?: string[];
    abilityPointIds?: string[];
    sortOrder: number;
  }>;
  scoreRules?: Array<{
    id: string;
    name: string;
    description?: string | null;
    rule?: string | null;
    weight: number;
    sortOrder: number;
  }>;
  reviewSteps?: Array<{
    id: string;
    label: string;
    description?: string | null;
    enabled: boolean;
    subjectType?: string | null;
    assignedUserIds?: string[];
    weight: number;
    sortOrder: number;
  }>;
}

export function methodsToEvalRuleConfig(methods: TaskEvaluationMethod[]): EvalRuleConfig {
  const allKeys = (methods || []).map((m) => normalizeMethod(m.methodKey) as EvalRuleMethodKey);
  const state = makeDefaultEvalRuleConfigLocal(allKeys);
  if (!methods || methods.length === 0) return state;
  state.evaluationMethods = methods
    .filter((m) => m.isEnabled !== false)
    .map((m) => normalizeMethod(m.methodKey) as EvalRuleMethodKey);
  state.disabledEvaluationMethods = methods
    .filter((m) => m.isEnabled === false)
    .map((m) => normalizeMethod(m.methodKey) as EvalRuleMethodKey);
  methods.forEach((m) => {
    const mk = normalizeMethod(m.methodKey);
    state.methodWeights[mk] = m.weight;
    state.methodEvalObjects[mk] = (m.evalObject as EvalObjectType) || 'individual';
    if (m.evalSubjects && m.evalSubjects.length > 0) {
      state.methodEvalSubjects[mk] = m.evalSubjects as EvalRuleSubjectConfig[];
    }
    const resourceConfig = m.resourceConfig || {};
    state.methodResourceConfigs[mk] = resourceConfig;
    const toLocalEvalPoint = (ep: any): EvalRulePoint => ({
      id: ep.id || uid('ep'),
      name: ep.name,
      desc: ep.description || '',
      subType: ep.subType,
      types: ep.types,
      knowledgePointIds: ep.knowledgePointIds,
      abilityPointIds: ep.abilityPointIds,
      scoringMethod: ep.scoringMethod as EvalRulePoint['scoringMethod'],
      gradeMapping: ep.gradeMapping,
      weight: ep.weight
    });
    const toLocalScoreRule = (sr: any): EvalRuleScoreRule => ({
      id: sr.id || uid('sr'),
      name: sr.name,
      desc: sr.description || '',
      rule: sr.rule || '',
      weight: sr.weight
    });
    const standardName = m.standardName || undefined;
    const standardMode: EvalStandardMode | undefined =
      m.standardMode === 'score_rule'
        ? 'score_rule'
        : m.standardMode === 'rubric'
          ? 'rubric'
          : undefined;
    const scoreRules = (m.scoreRules || []).map(toLocalScoreRule);
    switch (mk) {
      case 'random_draw':
        state.randomDrawEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        state.randomDrawScoreType =
          m.scoreType === 'ability_levels' ? 'ability_levels' : 'eval_points';
        state.randomDrawRubricId = m.rubricTemplateId || null;
        state.randomDrawStandardName = standardName;
        state.randomDrawStandardMode = standardMode;
        state.randomDrawScoreRules = scoreRules;
        if (resourceConfig.selectedQuestionIds) {
          state.randomDrawSelectedIds = resourceConfig.selectedQuestionIds;
        }
        if (resourceConfig.customQuestions) {
          state.randomDrawCustomQuestions = resourceConfig.customQuestions;
        }
        break;
      case 'review':
        state.reviewEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        state.reviewScoreType = m.scoreType === 'ability_levels' ? 'ability_levels' : 'eval_points';
        state.reviewRubricId = m.rubricTemplateId || null;
        state.reviewStandardName = standardName;
        state.reviewStandardMode = standardMode;
        state.reviewScoreRules = scoreRules;
        state.reviewSteps = (m.reviewSteps || []).map((rs: any, i: number) => ({
          label: rs.label,
          description: rs.description || null,
          enabled: rs.enabled,
          subjectType: rs.subjectType || null,
          assignedUserIds: rs.assignedUserIds || [],
          weight: rs.weight,
          sortOrder: rs.sortOrder ?? i
        }));
        break;
      case 'paper':
        state.paperEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        if (resourceConfig.paperId) state.paperIds = [resourceConfig.paperId];
        if (resourceConfig.paperWeight !== undefined && resourceConfig.paperId) {
          state.paperWeights[resourceConfig.paperId] = resourceConfig.paperWeight;
        }
        break;
      case 'question_bank':
        state.questionBankEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        if (resourceConfig.questionIds) state.questionBankQuestions = resourceConfig.questionIds;
        break;
      case 'outcome':
        state.outcomeEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        state.outcomeScoreType = m.scoreType === 'ability_levels' ? 'ability_levels' : 'eval_points';
        state.outcomeRubricId = m.rubricTemplateId || null;
        state.outcomeStandardName = standardName;
        state.outcomeStandardMode = standardMode;
        state.outcomeScoreRules = scoreRules;
        break;
      case 'homework':
        state.homeworkEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        state.homeworkScoreType = m.scoreType === 'ability_levels' ? 'ability_levels' : 'eval_points';
        state.homeworkRubricId = m.rubricTemplateId || null;
        state.homeworkStandardName = standardName;
        state.homeworkStandardMode = standardMode;
        state.homeworkScoreRules = scoreRules;
        break;
      case 'quiz':
        state.quizEvalPoints = (m.evalPoints || []).map(toLocalEvalPoint);
        if (resourceConfig.questionIds) state.quizQuestions = resourceConfig.questionIds;
        break;
    }
  });
  return state;
}

export function evalRuleConfigToMethods(config: EvalRuleConfig): any[] {
  const evalPointFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: 'randomDrawEvalPoints',
    review: 'reviewEvalPoints',
    paper: 'paperEvalPoints',
    question_bank: 'questionBankEvalPoints',
    outcome: 'outcomeEvalPoints',
    homework: 'homeworkEvalPoints',
    quiz: 'quizEvalPoints'
  };
  const scoreTypeFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: 'randomDrawScoreType',
    review: 'reviewScoreType',
    outcome: 'outcomeScoreType',
    homework: 'homeworkScoreType'
  };
  const standardNameFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: 'randomDrawStandardName',
    review: 'reviewStandardName',
    outcome: 'outcomeStandardName',
    homework: 'homeworkStandardName'
  };
  const standardModeFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: 'randomDrawStandardMode',
    review: 'reviewStandardMode',
    outcome: 'outcomeStandardMode',
    homework: 'homeworkStandardMode'
  };
  const scoreRulesFieldMap: Record<string, keyof EvalRuleConfig> = {
    random_draw: 'randomDrawScoreRules',
    review: 'reviewScoreRules',
    outcome: 'outcomeScoreRules',
    homework: 'homeworkScoreRules'
  };

  const allMethodKeys = Array.from(
    new Set([...config.evaluationMethods, ...(config.disabledEvaluationMethods || [])])
  );

  return allMethodKeys.map((mk) => {
    const fromLocalEvalPoint = (p: EvalRulePoint) => ({
      name: p.name,
      description: p.desc || null,
      subType: p.subType || null,
      types: p.types || [],
      weight: p.weight || 0,
      scoringMethod: p.scoringMethod || 'level',
      gradeMapping: p.gradeMapping || [],
      knowledgePointIds: p.knowledgePointIds || [],
      abilityPointIds: p.abilityPointIds || [],
      sortOrder: 0
    });

    const evalField = evalPointFieldMap[mk];
    const evalPoints = evalField
      ? (((config as any)[evalField] as EvalRulePoint[]) || []).map((p, i) => ({
          ...fromLocalEvalPoint(p),
          sortOrder: i
        }))
      : [];
    const scoreType = scoreTypeFieldMap[mk]
      ? ((config as any)[scoreTypeFieldMap[mk]] as EvalScoreType | null)
      : null;
    const standardName = standardNameFieldMap[mk]
      ? ((config as any)[standardNameFieldMap[mk]] as string | undefined)
      : undefined;
    const standardMode = standardModeFieldMap[mk]
      ? ((config as any)[standardModeFieldMap[mk]] as EvalStandardMode | undefined)
      : undefined;
    const scoreRules = (
      scoreRulesFieldMap[mk]
        ? ((config as any)[scoreRulesFieldMap[mk]] as EvalRuleScoreRule[] | undefined)
        : []
    )?.map((sr, i) => ({
      name: sr.name,
      description: sr.desc || null,
      rule: sr.rule || null,
      weight: sr.weight || 0,
      sortOrder: i
    }));

    const resourceConfig: Record<string, any> = { ...(config.methodResourceConfigs?.[mk] || {}) };
    if (mk === 'paper') {
      const paperId = config.paperIds?.[0];
      if (paperId) resourceConfig.paperId = paperId;
      if (paperId) resourceConfig.paperWeight = config.paperWeights[paperId] ?? 100;
    }
    if (mk === 'question_bank') {
      resourceConfig.questionIds = config.questionBankQuestions;
    }
    if (mk === 'quiz') {
      resourceConfig.questionIds = config.quizQuestions;
    }
    if (mk === 'random_draw') {
      resourceConfig.customQuestions = config.randomDrawCustomQuestions;
      resourceConfig.selectedQuestionIds = config.randomDrawSelectedIds;
    }

    return {
      methodKey: mk,
      weight: config.methodWeights[mk] || 0,
      evalObject: config.methodEvalObjects[mk] || config.evalObject || 'individual',
      scoreType,
      evalSubjects:
        (config.methodEvalSubjects[mk]?.length
          ? config.methodEvalSubjects[mk]
          : config.evalSubjects) || [],
      standardName: standardName || null,
      standardMode: standardMode || null,
      isEnabled: config.evaluationMethods.includes(mk),
      evalPoints: standardMode === 'score_rule' ? [] : evalPoints,
      scoreRules: standardMode === 'score_rule' ? scoreRules || [] : [],
      reviewSteps: mk === 'review' ? config.reviewSteps || [] : [],
      resourceConfig
    };
  });
}

/* ============ 默认任务状态 ============ */

const defaultEvalSubjects: EvalRuleSubjectConfig[] = [
  { type: 'teacher', enabled: true, params: { weightPercent: 50, scorerCount: 1 } },
  { type: 'enterprise_mentor', enabled: false, params: { weightPercent: 20 } },
  { type: 'self', enabled: false, params: { weightPercent: 10 } },
  { type: 'peer', enabled: false, params: { weightPercent: 20, peerCount: 3 } }
];

function makeDefaultEvalRuleConfigLocal(methods: EvalRuleMethodKey[]): EvalRuleConfig {
  const count = methods.length;
  const methodWeights: Record<string, number> = {};
  methods.forEach((m, i) => {
    methodWeights[m] = count > 0 ? Math.floor(100 / count) + (i < 100 % count ? 1 : 0) : 0;
  });
  return {
    evaluationMethods: methods,
    disabledEvaluationMethods: [],
    methodWeights,
    evalObject: 'individual',
    methodEvalObjects: {},
    evalSubjects: clone(DEFAULT_EVAL_RULE_SUBJECTS),
    methodEvalSubjects: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
    reviewSteps: [],
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: 'eval_points',
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: 'eval_points',
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    gradeMapping: clone(DEFAULT_EVAL_RULE_GRADE_MAPPING),
    methodResourceConfigs: {}
  };
}

export function makeDefaultTaskState(count: number, index: number): TaskState {
  return {
    description: '',
    descriptionPdf: null,
    knowledgePoints: [],
    knowledgeAutoResources: [],
    abilityPoints: [],
    abilityLevelMappings: [],
    resources: [],
    evaluationMethods: [],
    disabledEvaluationMethods: [],
    methodWeights: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
    paperIds: [],
    paperWeights: {},
    paperEvalPoints: [],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: 'eval_points',
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: 'eval_points',
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    weight: count > 0 ? Math.floor(100 / count) + (index < 100 % count ? 1 : 0) : 0,
    locked: false,
    gradeMapping: clone(defaultGradeMapping),
    scoringConfig: { teacherBackground: '', scorerCount: 1, requiresEnterpriseMentor: false },
    evalObject: 'individual',
    evalSubjects: clone(defaultEvalSubjects),
    methodEvalObjects: {},
    methodEvalSubjects: {},
    evalMethodConfigs: {},
    reviewSteps: [],
    methodResourceConfigs: {},
    evalMethodVersion: 0
  };
}

export function taskStateFromMethods(methods: TaskEvaluationMethod[]): TaskState {
  const state = makeDefaultTaskState(0, 0);
  if (!methods || methods.length === 0) return state;

  const evalConfig = methodsToEvalRuleConfig(methods);
  Object.assign(state, {
    evaluationMethods: evalConfig.evaluationMethods,
    disabledEvaluationMethods: evalConfig.disabledEvaluationMethods,
    methodWeights: evalConfig.methodWeights,
    evalObject: evalConfig.evalObject,
    methodEvalObjects: evalConfig.methodEvalObjects,
    evalSubjects: evalConfig.evalSubjects,
    methodEvalSubjects: evalConfig.methodEvalSubjects,
    randomDrawQuestions: evalConfig.randomDrawQuestions,
    randomDrawCustomQuestions: evalConfig.randomDrawCustomQuestions,
    randomDrawSelectedIds: evalConfig.randomDrawSelectedIds,
    randomDrawEvalPoints: evalConfig.randomDrawEvalPoints,
    randomDrawScoreType: evalConfig.randomDrawScoreType,
    randomDrawRubricId: evalConfig.randomDrawRubricId,
    randomDrawStandardName: evalConfig.randomDrawStandardName,
    randomDrawStandardMode: evalConfig.randomDrawStandardMode,
    randomDrawScoreRules: evalConfig.randomDrawScoreRules,
    reviewEvalPoints: evalConfig.reviewEvalPoints,
    reviewScoreType: evalConfig.reviewScoreType,
    reviewRubricId: evalConfig.reviewRubricId,
    reviewStandardName: evalConfig.reviewStandardName,
    reviewStandardMode: evalConfig.reviewStandardMode,
    reviewScoreRules: evalConfig.reviewScoreRules,
    paperIds: evalConfig.paperIds,
    paperWeights: evalConfig.paperWeights,
    paperEvalPoints: evalConfig.paperEvalPoints,
    questionBankQuestions: evalConfig.questionBankQuestions,
    questionBankEvalPoints: evalConfig.questionBankEvalPoints,
    outcomeEvalPoints: evalConfig.outcomeEvalPoints,
    outcomeScoreType: evalConfig.outcomeScoreType,
    outcomeRubricId: evalConfig.outcomeRubricId,
    outcomeStandardName: evalConfig.outcomeStandardName,
    outcomeStandardMode: evalConfig.outcomeStandardMode,
    outcomeScoreRules: evalConfig.outcomeScoreRules,
    homeworkEvalPoints: evalConfig.homeworkEvalPoints,
    homeworkScoreType: evalConfig.homeworkScoreType,
    homeworkRubricId: evalConfig.homeworkRubricId,
    homeworkStandardName: evalConfig.homeworkStandardName,
    homeworkStandardMode: evalConfig.homeworkStandardMode,
    homeworkScoreRules: evalConfig.homeworkScoreRules,
    quizQuestions: evalConfig.quizQuestions,
    quizEvalPoints: evalConfig.quizEvalPoints,
    gradeMapping: evalConfig.gradeMapping,
    methodResourceConfigs: evalConfig.methodResourceConfigs
  });

  const reviewMethod = methods.find((m) => m.methodKey === 'review');
  if (reviewMethod?.reviewSteps) {
    state.reviewSteps = reviewMethod.reviewSteps.map((rs: any) => ({
      id: rs.id,
      label: rs.label,
      desc: rs.description || '',
      enabled: rs.enabled,
      subjectType: rs.subjectType,
      assignedUserIds: rs.assignedUserIds || [],
      weight: rs.weight
    }));
  }

  state.evalMethodVersion = methods.reduce((max, m) => Math.max(max, m.version || 0), 0);

  return state;
}

export function taskStateToMethodsInput(ts: TaskState, extra?: { reviewSteps?: any[] }): any[] {
  const evalConfig = makeDefaultEvalRuleConfigLocal([]);
  Object.assign(evalConfig, {
    evaluationMethods: (ts.evaluationMethods || []).map(normalizeMethod),
    disabledEvaluationMethods: (ts.disabledEvaluationMethods || []).map(normalizeMethod),
    methodWeights: normalizeMap(ts.methodWeights || {}),
    evalObject: ts.evalObject,
    methodEvalObjects: normalizeMap(ts.methodEvalObjects || {}),
    evalSubjects: ts.evalSubjects,
    methodEvalSubjects: normalizeMap(ts.methodEvalSubjects || {}),
    randomDrawQuestions: ts.randomDrawQuestions,
    randomDrawCustomQuestions: ts.randomDrawCustomQuestions,
    randomDrawSelectedIds: ts.randomDrawSelectedIds,
    randomDrawEvalPoints: ts.randomDrawEvalPoints,
    randomDrawScoreType: ts.randomDrawScoreType,
    randomDrawRubricId: ts.randomDrawRubricId,
    randomDrawStandardName: ts.randomDrawStandardName,
    randomDrawStandardMode: ts.randomDrawStandardMode,
    randomDrawScoreRules: ts.randomDrawScoreRules,
    reviewEvalPoints: ts.reviewEvalPoints,
    reviewScoreType: ts.reviewScoreType,
    reviewRubricId: ts.reviewRubricId,
    reviewStandardName: ts.reviewStandardName,
    reviewStandardMode: ts.reviewStandardMode,
    reviewScoreRules: ts.reviewScoreRules,
    paperIds: ts.paperIds,
    paperWeights: ts.paperWeights,
    paperEvalPoints: ts.paperEvalPoints,
    questionBankQuestions: ts.questionBankQuestions,
    questionBankEvalPoints: ts.questionBankEvalPoints,
    outcomeEvalPoints: ts.outcomeEvalPoints,
    outcomeScoreType: ts.outcomeScoreType,
    outcomeRubricId: ts.outcomeRubricId,
    outcomeStandardName: ts.outcomeStandardName,
    outcomeStandardMode: ts.outcomeStandardMode,
    outcomeScoreRules: ts.outcomeScoreRules,
    homeworkEvalPoints: ts.homeworkEvalPoints,
    homeworkScoreType: ts.homeworkScoreType,
    homeworkRubricId: ts.homeworkRubricId,
    homeworkStandardName: ts.homeworkStandardName,
    homeworkStandardMode: ts.homeworkStandardMode,
    homeworkScoreRules: ts.homeworkScoreRules,
    quizQuestions: ts.quizQuestions,
    quizEvalPoints: ts.quizEvalPoints,
    gradeMapping: ts.gradeMapping,
    methodResourceConfigs: normalizeMap(ts.methodResourceConfigs || {})
  });

  const methods = evalRuleConfigToMethods(evalConfig);

  if (evalConfig.evaluationMethods.includes('review')) {
    const reviewIdx = methods.findIndex((m) => m.methodKey === 'review');
    if (reviewIdx >= 0) {
      const reviewSteps = extra?.reviewSteps ?? ts.reviewSteps;
      methods[reviewIdx].reviewSteps = (reviewSteps || []).map((rs: any, i: number) => ({
        label: rs.label,
        description: rs.desc || null,
        enabled: rs.enabled,
        subjectType: rs.subjectType,
        assignedUserIds: rs.assignedUserIds || [],
        weight: rs.weight,
        sortOrder: i
      }));
    }
  }

  return methods;
}

/* ============ 默认资源配置（对齐 page.tsx DEFAULT_*_RESOURCE_CONFIG） ============ */

export const DEFAULT_RANDOM_DRAW_RESOURCE_CONFIG = {
  questionCount: 5,
  difficulty: 'mixed',
  types: { single: true, multiple: true, judge: true },
  autoDraw: true,
  submitFormatDesc: '',
  venueResources: ''
};

export const DEFAULT_REVIEW_RESOURCE_CONFIG = {
  materialType: 'project_report',
  submitFormatDesc: '请提交 PDF 格式的项目报告，包含完整的项目背景、实现方案、测试结果和总结反思。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources: '多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。',
  requiresMaterial: true
};

export const DEFAULT_OUTCOME_RESOURCE_CONFIG = {
  materialType: 'project_report',
  submitFormatDesc: '请提交 PDF 格式的成果材料，包含完整的项目背景、实现方案、测试结果和总结反思。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources: '多媒体教室（容纳30人）、投影仪、白板、评委席桌椅、计时器、签到表、评分表及文具。',
  requiresMaterial: true
};

export const DEFAULT_HOMEWORK_RESOURCE_CONFIG = {
  materialType: 'homework_file',
  submitFormatDesc: '请提交 PDF 或 DOCX 格式的作业文件。',
  deadlineDays: 7,
  allowResubmit: false,
  venueResources: '',
  requiresMaterial: true
};
