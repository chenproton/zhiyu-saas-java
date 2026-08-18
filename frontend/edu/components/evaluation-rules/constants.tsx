'use client'

import type { GradeMapping } from '@/lib/types/lesson'
import type { EvalRuleSubjectConfig, EvalRulePoint } from '@/lib/types/evaluation'
import { DEFAULT_EVAL_RULE_GRADE_MAPPING, DEFAULT_EVAL_RULE_SUBJECTS } from '@/lib/types/evaluation'
import { EVALUATION_METHOD_OPTIONS } from '@/components/shared/eval-method-selector'
import type { EvalSubType } from './types'

// 测评方式选项唯一数据源：shared/eval-method-selector 的 EVALUATION_METHOD_OPTIONS，
// 此处仅保留平台侧选项（与任务/课程共用，避免多份数据漂移）
export const evaluationMethodOptions = EVALUATION_METHOD_OPTIONS.filter(
  (o) => o.primaryCategory === 'platform',
)

export const evalSubTypeLabels: Record<EvalSubType, string> = {
  knowledge_mastery: '知识掌握',
  operation_standard: '操作规范',
  task_completion: '任务完成度',
  result_quality: '成果质量',
  communication: '沟通表达',
  collaboration: '协作能力',
  professionalism: '职业素养',
  innovation: '创新能力',
  adaptability: '应变能力',
}

export const evalSubTypeColors: Record<EvalSubType, string> = {
  knowledge_mastery: 'bg-blue-50 text-blue-600 border-blue-200',
  operation_standard: 'bg-teal-50 text-teal-600 border-teal-200',
  task_completion: 'bg-green-50 text-green-600 border-green-200',
  result_quality: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  communication: 'bg-violet-50 text-violet-600 border-violet-200',
  collaboration: 'bg-orange-50 text-orange-600 border-orange-200',
  professionalism: 'bg-amber-50 text-amber-600 border-amber-200',
  innovation: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  adaptability: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const abilityLevels = ['了解', '理解', '掌握', '熟练', '精通']

export const defaultGradeMapping: GradeMapping[] = DEFAULT_EVAL_RULE_GRADE_MAPPING

export const defaultEvalSubjects: EvalRuleSubjectConfig[] = DEFAULT_EVAL_RULE_SUBJECTS

export const defaultEvalPoints: EvalRulePoint[] = []
