'use client'

import { useMemo, type ReactNode } from 'react'
import {
  Database,
  ClipboardList,
  BookOpen,
  FileQuestion,
  FolderCheck,
  Gavel,
  PenTool,
} from 'lucide-react'
import { EvalMethodSelector } from './eval-method-selector'
import { CourseEvaluationRulesDialog } from '@/app/lesson/admin/_components/assessment/course-evaluation-rules-dialog'
import type { EvalRuleConfig, EvalRuleMethodKey } from '@/lib/types/evaluation'
import { mergeEvalRuleMethods } from '@/lib/types/evaluation'
import type { KnowledgePointItem } from '@/lib/types/lesson'

export const EVAL_METHOD_DISPLAY: Record<
  string,
  { label: string; icon: ReactNode; color: string }
> = {
  question_bank: {
    label: '题库',
    icon: <Database className="h-5 w-5" />,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
  },
  paper: {
    label: '试卷',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-green-50 text-green-600 border-green-200',
  },
  quiz: {
    label: '随堂测',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-red-50 text-red-600 border-red-200',
  },
  random_draw: {
    label: '现场问答',
    icon: <FileQuestion className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
  },
  review: {
    label: '现场评审',
    icon: <Gavel className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600 border-purple-200',
  },
  outcome: {
    label: '成果评价',
    icon: <FolderCheck className="h-5 w-5" />,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  },
  homework: {
    label: '作业',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
  },
}

export interface EvalMethodConfigModuleProps {
  value: EvalRuleConfig | Partial<EvalRuleConfig> | undefined
  onChange: (config: EvalRuleConfig) => void
  knowledgePoints?: KnowledgePointItem[]
  abilityPoints?: { id: string; name: string; code?: string; description?: string }[]
  methodTitle?: string
  rulesTitle?: string
}

export function EvalMethodConfigModule({
  value,
  onChange,
  knowledgePoints = [],
  abilityPoints = [],
  methodTitle = '配置测评方式',
  rulesTitle = '配置评价规则',
}: EvalMethodConfigModuleProps) {
  const config = useMemo<EvalRuleConfig>(() => {
    if (!value) {
      return {
        evaluationMethods: [],
        disabledEvaluationMethods: [],
        methodWeights: {},
        evalObject: 'individual',
        methodEvalObjects: {},
        evalSubjects: [],
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
        gradeMapping: [],
        methodResourceConfigs: {},
      }
    }
    return value as EvalRuleConfig
  }, [value])

  const methods = config.evaluationMethods || []

  return (
    <div className="space-y-6">
      {/* Section 1: Method Selection */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{methodTitle}</h4>
        <EvalMethodSelector
          value={methods}
          onChange={(nextMethods) => {
            onChange(mergeEvalRuleMethods(config, nextMethods as EvalRuleMethodKey[]))
          }}
        />
      </div>

      {/* Section 2: Rules Configuration */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{rulesTitle}</h4>
        {methods.length > 0 ? (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={config}
            onChange={onChange}
            knowledgePoints={knowledgePoints}
            abilityPoints={abilityPoints}
            title={rulesTitle}
          />
        ) : (
          <div className="text-center text-gray-400 py-8 bg-gray-50 rounded-lg border">
            <PenTool className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">请先在上方选择至少一种测评方式，再配置评价规则</p>
          </div>
        )}
      </div>
    </div>
  )
}
