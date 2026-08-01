"use client"

import { Award } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@zhiyu/ui"
import type { KnowledgePointItem } from "@/lib/types/lesson"
import type { EvalRuleConfig, EvalRuleMethodKey } from "@/lib/types/evaluation"
import { makeDefaultEvalRuleConfig } from "@/lib/types/evaluation"
import {
  EvaluationRulesEditor,
  type AbilityPointItem,
} from "@/components/evaluation-rules"

export type { EvalRuleConfig as CourseEvalRulesConfig, EvalRuleMethodKey }
export type { EvalRulePoint as EvalPoint } from "@/lib/types/evaluation"
export type { AbilityPointItem }

interface CourseEvaluationRulesDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  inline?: boolean
  evaluationMethods: string[]
  initialConfig?: Partial<EvalRuleConfig>
  onChange?: (config: EvalRuleConfig) => void
  title?: string
  knowledgePoints?: KnowledgePointItem[]
  abilityPoints?: AbilityPointItem[]
}

export function CourseEvaluationRulesDialog({
  open,
  onOpenChange,
  inline,
  evaluationMethods,
  initialConfig,
  onChange,
  title = "配置课程评价规则",
  knowledgePoints,
  abilityPoints,
}: CourseEvaluationRulesDialogProps) {
  const { toast } = useToast()
  const [liveConfig, setLiveConfig] = useState<EvalRuleConfig | null>(null)

  const config = useMemo<EvalRuleConfig>(() => {
    const methods = (evaluationMethods || []).map(
      m => (m === "exam" ? "homework" : m) as EvalRuleMethodKey
    )
    const base = makeDefaultEvalRuleConfig(methods)
    return initialConfig ? { ...base, ...initialConfig, evaluationMethods: methods } : base
  }, [evaluationMethods, initialConfig])

  const handleChange = useCallback(
    (next: EvalRuleConfig) => {
      setLiveConfig(next)
      onChange?.(next)
    },
    [onChange]
  )

  const methodWeightTotal = useMemo(() => {
    const source = liveConfig || config
    return source.evaluationMethods.reduce((sum, m) => {
      // The store internally maps "exam" to "homework"; methodWeights keys follow the internal key.
      const weightKey = (m as string) === "exam" ? "homework" : m
      return sum + (source.methodWeights[weightKey] || 0)
    }, 0)
  }, [liveConfig, config])

  if (inline) {
    return (
      <EvaluationRulesEditor
        inline
        evaluationMethods={evaluationMethods}
        config={config}
        onChange={handleChange}
        title={title}
        knowledgePoints={knowledgePoints}
        abilityPoints={abilityPoints}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[95vw] max-h-[95vh] h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <Award className="h-5 w-5" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription>配置各评价方式的测评对象、评价主体、测评资源与评价标准</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden py-4">
          <EvaluationRulesEditor
            evaluationMethods={evaluationMethods}
            config={config}
            onChange={handleChange}
            title={title}
            knowledgePoints={knowledgePoints}
            abilityPoints={abilityPoints}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (methodWeightTotal !== 100) {
                toast({
                  variant: "destructive",
                  title: "权重校验失败",
                  description: `评价方式权重合计需等于 100%，当前为 ${methodWeightTotal}%`,
                })
                return
              }
              onOpenChange?.(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CourseEvaluationRulesDialog
