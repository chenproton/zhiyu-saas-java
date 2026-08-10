'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, AlertCircle, Sparkles, Loader2 } from 'lucide-react'
import type { Position, PositionAbilityBinding, CompetencyLevel } from '@/lib/types/job-source'
import { positionAiAssist } from '@/lib/api'
import { ToastAction } from '@/components/ui/toast'
import { toast } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'
import { AiAssistProgressDialog } from '../ai-assist-progress-dialog'

const COMPETENCY_LEVELS: { value: CompetencyLevel; label: string }[] = [
  { value: 'understand', label: '了解' },
  { value: 'comprehend', label: '理解' },
  { value: 'master', label: '掌握' },
  { value: 'proficient', label: '熟练' },
  { value: 'expert', label: '精通' },
]

// 字典保存值保持以下 5 个不变，hint 仅在下拉列表中展示说明文案（hint 在组件内用 t() 翻译）
const ABILITY_DOMAINS: { value: string; hint: string }[] = [
  { value: '岗位与行业认知', hint: '如行业常识、岗位职责、发展趋势类能力点' },
  { value: '专业知识', hint: '如专业理论、概念、原理、标准、规范、法规等知识类能力点' },
  { value: '专业技能', hint: '如实操、工具使用、业务处理、专项操作类能力点' },
  { value: '通用能力', hint: '如沟通、协作、思维、学习、执行、管理等通用综合能力点' },
  { value: '职业素养/价值观', hint: '价值观、责任心、敬业度、职业操守等素养类能力点' },
]

interface Step3ResultTableProps {
  position: Position
  onUpdate: (data: Partial<Position>) => void
}

export function Step3ResultTable({ position, onUpdate }: Step3ResultTableProps) {
  const t = useT()
  const bindings = position.abilityBindings
  const [aiNotice] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiPhase, setAiPhase] = useState(0)
  const [aiRunning, setAiRunning] = useState(false)
  const [confirmAiOpen, setConfirmAiOpen] = useState(false)

  const handleUpdateBinding = (bindingId: string, updates: Partial<PositionAbilityBinding>) => {
    onUpdate({
      abilityBindings: position.abilityBindings.map((b) =>
        b.id === bindingId ? { ...b, ...updates } : b,
      ),
    })
  }

  /** AI 一键填充：为所有能力点生成掌握程度与胜任标准，直接写入表格 */
  const runAiFill = async () => {
    if (bindings.length === 0 || aiRunning) return
    setConfirmAiOpen(false)
    setAiRunning(true)
    setAiOpen(true)
    setAiPhase(0)
    const snapshot = bindings
    try {
      const res = await positionAiAssist({
        field: 'competency',
        position: {
          name: position.name,
          shortName: position.shortName,
          industry: position.industry,
          majors: [],
          salaryRange: position.salaryRange,
          description: position.description,
          responsibilities: position.responsibilities.map((r) => r.name),
          requirements: position.requirements,
          careerPath: position.careerPath,
          abilities: bindings.map((b) => ({
            name: b.name,
            domain: b.domain,
            attributes: b.attributes || [],
            description: b.rubricDescription || '',
          })),
        },
      })
      setAiPhase(1)
      const fills = res?.competencies || []
      if (fills.length > 0) {
        const byName = new Map(fills.map((f) => [f.name, f]))
        onUpdate({
          abilityBindings: position.abilityBindings.map((b) => {
            const fill = byName.get(b.name)
            if (!fill) return b
            return {
              ...b,
              level: fill.level as CompetencyLevel,
              rubricDescription: fill.rubricDescription || b.rubricDescription,
            }
          }),
        })
        toast({
          title: t('AI 已填充 {n} 个能力点的掌握标准', { n: fills.length }),
          description: t('10 秒内可撤销'),
          duration: 10000,
          action: (
            <ToastAction
              altText={t('撤销')}
              className="h-7 px-2.5 text-xs bg-white border-gray-200 hover:bg-gray-50"
              onClick={() => {
                onUpdate({ abilityBindings: snapshot })
                toast({ title: t('已撤销') })
              }}
            >
              {t('撤销')}
            </ToastAction>
          ),
        })
      }
    } finally {
      setAiOpen(false)
      setAiRunning(false)
    }
  }

  const groups = new Map<string, typeof bindings>()
  for (const b of bindings) {
    const key = b.domain || t('未分类')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(b)
  }

  const domainCount =
    new Set(bindings.map((b) => b.domain).filter(Boolean)).size +
    (bindings.some((b) => !b.domain) ? 1 : 0)

  return (
    <div className="space-y-5">
      {aiNotice && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{aiNotice}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">{t('工作职责')}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {position.responsibilities.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">{t('能力点')}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{bindings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-xs text-gray-500">{t('能力域')}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{domainCount}</p>
            </CardContent>
          </Card>
        </div>
        <div className="pl-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 gap-1"
            disabled={aiRunning || bindings.length === 0}
            onClick={() => setConfirmAiOpen(true)}
          >
            {aiRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiRunning ? t('AI 填充中...') : t('AI 辅助编写')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('能力模型明细表')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {bindings.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t('暂无能力点数据')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('请返回步骤二进行拆解')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[120px]">{t('所属能力领域')}</TableHead>
                    <TableHead className="w-[140px]">{t('能力点名称')}</TableHead>
                    <TableHead className="w-[80px]">{t('能力属性')}</TableHead>
                    <TableHead className="w-[120px]">{t('能力领域')}</TableHead>
                    <TableHead className="w-[120px]">{t('掌握程度')}</TableHead>
                    <TableHead>{t('胜任标准描述')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const rows: React.ReactNode[] = []
                    for (const [domain, group] of groups) {
                      group.forEach((binding, idx) => {
                        rows.push(
                          <TableRow key={binding.id}>
                            {idx === 0 && (
                              <TableCell rowSpan={group.length} className="align-middle">
                                <Badge variant="outline" className="text-[10px]">
                                  {domain}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="font-medium text-sm">{binding.name}</TableCell>
                            <TableCell>
                              <span className="text-xs text-gray-700">
                                {(binding.attributes || []).join('、') || '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={binding.domain || ''}
                                onValueChange={(v) =>
                                  handleUpdateBinding(binding.id, { domain: v || undefined })
                                }
                              >
                                <SelectTrigger className="h-7 text-[11px] w-[110px]">
                                  <SelectValue placeholder={t('选择领域')} />
                                </SelectTrigger>
                                <SelectContent className="min-w-[320px]">
                                  {ABILITY_DOMAINS.map((d) => (
                                    <SelectItem key={d.value} value={d.value} hint={`（${t(d.hint)}）`}>
                                      {d.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={binding.level}
                                onValueChange={(v) =>
                                  handleUpdateBinding(binding.id, { level: v as CompetencyLevel })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-[100px]">
                                  <SelectValue placeholder={t('请选择')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {COMPETENCY_LEVELS.map((l) => (
                                    <SelectItem key={l.value} value={l.value}>
                                      {t(l.label)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 min-w-[240px]">
                              <Input
                                value={binding.rubricDescription}
                                onChange={(e) =>
                                  handleUpdateBinding(binding.id, {
                                    rubricDescription: e.target.value,
                                  })
                                }
                                placeholder={t('请输入胜任标准描述...')}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                          </TableRow>,
                        )
                      })
                    }
                    return rows
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI 填充意图确认弹窗 */}
      <Dialog open={confirmAiOpen} onOpenChange={setConfirmAiOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {t('确认 AI 填充掌握标准？')}
            </DialogTitle>
            <DialogDescription>
              {t('AI 将为 {n} 个能力点生成掌握程度与胜任标准描述并直接写入表格，可一键撤销。', { n: bindings.length })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmAiOpen(false)}>
              {t('取消')}
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700 gap-1" onClick={runAiFill}>
              <Sparkles className="h-4 w-4" />
              {t('确认生成')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI 填充进度弹窗 */}
      <AiAssistProgressDialog
        open={aiOpen}
        onOpenChange={(open) => {
          if (!open && !aiRunning) setAiOpen(false)
        }}
        title={t('AI 辅助填充')}
        description={t('大模型正在为能力点生成掌握程度与胜任标准')}
        steps={[t('分析能力点特征'), t('生成掌握程度与胜任标准')]}
        currentStep={aiPhase}
        progress={aiPhase > 0 ? 100 : 40}
      />
    </div>
  )
}
