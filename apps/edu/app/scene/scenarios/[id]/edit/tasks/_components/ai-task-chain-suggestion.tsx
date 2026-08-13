'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2, Sparkles, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { scenarioAiAssist } from '@/lib/api'
import type { AIScenarioTaskChainTask } from '@/lib/api'
import { toast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { AiNotConfiguredDialog } from '@/components/shared/ai-not-configured-dialog'
import { useAiNotConfigured, useAiPipeline } from '@/lib/ai/use-ai-assist'

/**
 * AI 任务链结构建议（交互参考 demo：意图输入 → 建议面板勾选 → 采纳创建）。
 * 与字段级 AI 的区别：生成的是新实体清单，无法"直接写入+恢复上版"，故采用建议面板形态；
 * 视觉语言（紫色 Sparkles/面板）与错误体系（412 引导、取消、toast）与既有 AI 底座一致。
 * 采纳后由父页面 onAdopt 负责创建任务（并给出 10 秒内撤销 toast）。
 */
export function AiTaskChainSuggestion({
  scenario,
  existingTasks,
  onAdopt,
  disabled,
}: {
  scenario: {
    name: string
    background: string
    positionName: string
    industryNames: string[]
    professionNames: string[]
    positionId: string
  }
  existingTasks: { name: string; type: 'training' | 'assessment'; difficulty: number }[]
  onAdopt: (tasks: AIScenarioTaskChainTask[]) => Promise<void>
  disabled?: boolean
}) {
  const t = useT()
  const [inputOpen, setInputOpen] = useState(false)
  const [input, setInput] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [result, setResult] = useState<AIScenarioTaskChainTask[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [adopting, setAdopting] = useState(false)

  const ai = useAiNotConfigured()
  const pipeline = useAiPipeline<unknown, { chain?: { tasks: AIScenarioTaskChainTask[] } }>({
    steps: [t('阅读场景信息'), t('设计任务链结构')],
    request: (_task, signal) =>
      scenarioAiAssist(
        {
          field: 'taskChain',
          scenario: {
            name: scenario.name,
            background: scenario.background,
            difficulty: 0,
            industryNames: scenario.industryNames,
            professionNames: scenario.professionNames,
            positionId: scenario.positionId,
            positionName: scenario.positionName,
            taskName: '',
            taskBackground: '',
            taskDescription: '',
            taskDifficulty: 0,
            existingTasks,
            intention: input.trim(),
          },
        },
        signal,
      ),
    onError: (err) => {
      if (ai.markNotConfigured(err)) return true
      toast({
        title: t('AI 生成失败'),
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
      return true
    },
  })

  const startGenerate = () => {
    if (!input.trim()) return
    setInputOpen(false)
    setPanelOpen(true)
    setResult(null)
    setSelected(new Set())
    void pipeline
      .run([
        {
          id: 'taskChain',
          meta: undefined,
          apply: (res) => {
            const tasks = res.chain?.tasks || []
            if (tasks.length === 0) return
            setResult(tasks)
            setSelected(new Set(tasks.map((_, i) => i)))
          },
        },
      ])
      .then((r) => {
        if (r.success === 0) setPanelOpen(false)
      })
  }

  const allSelected = result !== null && selected.size === result.length

  const handleAdopt = async () => {
    if (!result || selected.size === 0 || adopting) return
    const chosen = result.filter((_, i) => selected.has(i))
    setAdopting(true)
    try {
      await onAdopt(chosen)
      setPanelOpen(false)
      setResult(null)
      setSelected(new Set())
      setInput('')
    } finally {
      setAdopting(false)
    }
  }

  const assessCount = result?.filter((t2) => t2.type === 'assessment').length || 0
  const trainCount = result?.filter((t2) => t2.type === 'training').length || 0

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
        disabled={disabled || pipeline.isRunning}
        onClick={() => {
          setInput('')
          setInputOpen(true)
        }}
      >
        <Sparkles className="h-4 w-4" />
        {t('AI 建议任务链')}
      </Button>

      {/* 意图输入弹窗（对齐快速补全视觉） */}
      <Dialog open={inputOpen} onOpenChange={setInputOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('AI 建议任务链')}
            </DialogTitle>
            <DialogDescription>
              {t('请描述您想要的任务链方向和要求，AI 将据此生成建议')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 space-y-0.5">
              {scenario.name && (
                <p>
                  {t('场景')}：{scenario.name}
                </p>
              )}
              {scenario.positionName && (
                <p>
                  {t('目标岗位')}：{scenario.positionName}
                </p>
              )}
              {existingTasks.length > 0 && (
                <p>
                  {t('现有任务')}：{existingTasks.map((x) => x.name).join('、')}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="task-chain-intention">{t('任务描述及方向')}</Label>
              <Textarea
                id="task-chain-intention"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('例如：希望任务链从基础认知开始，逐步过渡到综合实战，最后以项目答辩收尾...')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInputOpen(false)}>
              {t('取消')}
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1"
              disabled={!input.trim()}
              onClick={startGenerate}
            >
              <Sparkles className="h-4 w-4" />
              {t('开始生成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 任务链建议面板（整行展示在按钮行下方，demo 形态） */}
      {panelOpen && (
        <div className="mb-4 border rounded-xl bg-white shadow-sm overflow-hidden w-full basis-full">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-purple-50/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-800">{t('AI 任务链结构建议')}</span>
              <span className="text-xs text-gray-500 hidden sm:inline">
                {t('AI 根据场景主题和目标岗位分析了建议的任务链结构')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!pipeline.isRunning && result && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSelected(
                        allSelected ? new Set() : new Set(result.map((_, i) => i)),
                      )
                    }
                  >
                    {allSelected ? t('取消全选') : t('全选')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selected.size === 0 || adopting}
                    onClick={handleAdopt}
                    className="bg-purple-600 hover:bg-purple-700 text-white gap-1"
                  >
                    {adopting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {t('采纳选中')} ({selected.size})
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  pipeline.cancel()
                  setPanelOpen(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            {pipeline.isRunning ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
                <p className="text-sm text-gray-500">{t('AI 正在分析最佳任务链结构...')}</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-purple-50 rounded-lg p-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-700">{result.length}</div>
                    <div className="text-xs text-gray-500">{t('建议任务数')}</div>
                  </div>
                  <div className="w-px h-10 bg-purple-200" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700">{assessCount}</div>
                    <div className="text-xs text-gray-500">{t('考核任务')}</div>
                  </div>
                  <div className="w-px h-10 bg-purple-200" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">{trainCount}</div>
                    <div className="text-xs text-gray-500">{t('训练任务')}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 overflow-x-auto pb-2">
                  {result.map((task, i) => (
                    <div
                      key={i}
                      className={cn(
                        'shrink-0 w-56 border rounded-lg p-3 hover:border-purple-300 transition-colors cursor-pointer relative',
                        selected.has(i) ? 'bg-purple-50/50 border-purple-300' : 'bg-gray-50/30',
                      )}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }}
                    >
                      <div className="absolute top-2 left-2">
                        <Checkbox
                          checked={selected.has(i)}
                          onCheckedChange={() => {}}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-2 mb-2 pl-6">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs flex items-center justify-center font-medium shrink-0">
                          {i + 1}
                        </span>
                        <span className="font-medium text-sm text-gray-800 truncate flex-1">
                          {task.name}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
                            task.type === 'assessment'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-green-50 text-green-700',
                          )}
                        >
                          {task.type === 'assessment' ? t('考核') : t('训练')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2 pl-6">
                        {task.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400 pl-6">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <Star
                              key={si}
                              className={cn(
                                'h-3 w-3',
                                si < task.difficulty
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-gray-200',
                              )}
                            />
                          ))}
                        </div>
                        <span>
                          {task.estimatedHours} {t('小时')}
                        </span>
                      </div>
                      <div className="flex justify-center mt-2">
                        {i < result.length - 1 ? (
                          <ArrowRight className="h-3 w-3 text-purple-300 rotate-90" />
                        ) : (
                          <div className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* AI 未配置引导弹窗 */}
      <AiNotConfiguredDialog open={ai.notConfiguredOpen} onOpenChange={ai.setNotConfiguredOpen} />
    </>
  )
}
