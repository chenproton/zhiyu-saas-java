'use client'

import { useMemo } from 'react'
import { PenTool } from 'lucide-react'
import { EvalMethodSelector } from './eval-method-selector'
import { CourseEvaluationRulesDialog } from '@/components/lesson/course-evaluation-rules-dialog'
import { EmptyState } from '@zhiyu/ui'
import type { EvalRuleConfig, EvalRuleMethodKey } from '@/lib/types/evaluation'
import { mergeEvalRuleMethods, DEFAULT_EVAL_RULE_SUBJECTS } from '@/lib/types/evaluation'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import { useT } from '@/lib/i18n/locale-provider'

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
  methodTitle,
  rulesTitle,
}: EvalMethodConfigModuleProps) {
  const t = useT()
  const methodTitleText = methodTitle ?? t('配置测评方式')
  const rulesTitleText = rulesTitle ?? t('配置评价规则')
  const config = useMemo<EvalRuleConfig>(() => {
    if (!value) {
      return {
        evaluationMethods: [],
        disabledEvaluationMethods: [],
        methodWeights: {},
        evalObject: 'individual',
        methodEvalObjects: {},
        evalSubjects: JSON.parse(JSON.stringify(DEFAULT_EVAL_RULE_SUBJECTS)),
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
        <h4 className="text-sm font-semibold mb-3">{methodTitleText}</h4>
        <EvalMethodSelector
          value={methods}
          onChange={(nextMethods) => {
            onChange(mergeEvalRuleMethods(config, nextMethods as EvalRuleMethodKey[]))
          }}
        />
      </div>

      {/* Section 2: Rules Configuration */}
      <div>
        <h4 className="text-sm font-semibold mb-3">{rulesTitleText}</h4>
        {methods.length > 0 ? (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={config}
            onChange={onChange}
            knowledgePoints={knowledgePoints}
            abilityPoints={abilityPoints}
            title={rulesTitleText}
          />
        ) : (
          <EmptyState
            icon={<PenTool className="h-8 w-8 opacity-40" />}
            title={t('请先在上方选择至少一种测评方式，再配置评价规则')}
            titleClassName="text-gray-400"
            className="py-8 bg-gray-50 rounded-lg border"
          />
        )}
      </div>
    </div>
  )
}
