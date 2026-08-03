'use client'

import { Database, FileQuestion, FileText, PenTool, BookOpen, ClipboardList } from 'lucide-react'
import type { GradeMapping } from '@/lib/types/lesson'
import type { EvalRuleSubjectConfig, EvalRulePoint } from '@/lib/types/evaluation'
import { DEFAULT_EVAL_RULE_GRADE_MAPPING, DEFAULT_EVAL_RULE_SUBJECTS } from '@/lib/types/evaluation'
import type { EvalSubType } from './types'

export const evaluationMethodOptions = [
  {
    key: 'question_bank',
    label: '题库',
    icon: <Database className="h-5 w-5" />,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    available: true,
    desc: '从题库选题组成测评资源',
  },
  {
    key: 'paper',
    label: '试卷',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-green-50 text-green-600 border-green-200',
    available: true,
    desc: '使用固定试卷进行考核',
  },
  {
    key: 'random_draw',
    label: '现场问答',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    available: true,
    desc: '从题库抽取题目，教师现场提问',
  },
  {
    key: 'review',
    label: '现场评审',
    icon: <PenTool className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    available: true,
    desc: '教师根据表现/材料给评价点打分',
  },
  {
    key: 'outcome',
    label: '成果评价',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    available: true,
    desc: '对学生成果进行评价',
  },
  {
    key: 'homework',
    label: '作业',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    available: true,
    desc: '学生提交作业进行评价',
  },
  {
    key: 'quiz',
    label: '随堂测',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-red-50 text-red-600 border-red-200',
    available: true,
    desc: '课堂即时测验',
  },
]

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
