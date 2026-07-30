"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { EvalMethodSelector } from "./eval-method-selector"
import { CourseEvaluationRulesDialog } from "@/app/lesson/admin/_components/assessment/course-evaluation-rules-dialog"
import type { EvalRuleConfig, EvalRuleMethodKey } from "@/lib/types/evaluation"
import { mergeEvalRuleMethods } from "@/lib/types/evaluation"
import type { KnowledgePointItem } from "@/lib/types/lesson"

export interface EvalMethodConfigPanelProps {
  value: EvalRuleConfig | Partial<EvalRuleConfig> | undefined
  onChange: (config: EvalRuleConfig) => void
  knowledgePoints?: KnowledgePointItem[]
  abilityPoints?: { id: string; name: string; code?: string; description?: string }[]
  title?: string
}

export function EvalMethodConfigPanel({
  value,
  onChange,
  knowledgePoints = [],
  abilityPoints = [],
  title = "配置课程评价规则",
}: EvalMethodConfigPanelProps) {
  const config = useMemo<EvalRuleConfig>(() => {
    if (!value) {
      return {
        evaluationMethods: [],
        disabledEvaluationMethods: [],
        methodWeights: {},
        evalObject: "individual",
        methodEvalObjects: {},
        evalSubjects: [],
        methodEvalSubjects: {},
        randomDrawQuestions: [],
        randomDrawCustomQuestions: [],
        randomDrawSelectedIds: [],
        randomDrawEvalPoints: [],
        randomDrawScoreType: "eval_points",
        randomDrawRubricId: null,
        reviewEvalPoints: [],
        reviewScoreType: "eval_points",
        reviewRubricId: null,
        reviewSteps: [],
        paperIds: [],
        paperWeights: {},
        paperEvalPoints: [],
        questionBankQuestions: [],
        questionBankEvalPoints: [],
        outcomeEvalPoints: [],
        outcomeScoreType: "eval_points",
        outcomeRubricId: null,
        homeworkEvalPoints: [],
        homeworkScoreType: "eval_points",
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
    <Card className="border-0 shadow-sm">
      <CardContent className="pt-5 space-y-5">
        <EvalMethodSelector
          value={methods}
          onChange={(nextMethods) => {
            onChange(mergeEvalRuleMethods(config, nextMethods as EvalRuleMethodKey[]))
          }}
        />

        {methods.length > 0 && (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={config}
            onChange={onChange}
            knowledgePoints={knowledgePoints}
            abilityPoints={abilityPoints}
            title={title}
          />
        )}

        {methods.length === 0 && (
          <div className="text-center text-gray-400 py-6 text-sm">
            请先选择至少一种测评方式，再配置评价规则
          </div>
        )}
      </CardContent>
    </Card>
  )
}
