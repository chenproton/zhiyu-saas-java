'use client'

import { useMemo } from 'react'
import { PenTool } from 'lucide-react'
import { EvalMethodSelector } from './eval-method-selector'
import { CourseEvaluationRulesDialog } from '@/components/lesson/course-evaluation-rules-dialog'
import type { EvalRuleConfig, EvalRuleMethodKey } from '@/lib/types/evaluation'
import { mergeEvalRuleMethods } from '@/lib/types/evaluation'
import type { KnowledgePointItem } from '@/lib/types/lesson'

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
