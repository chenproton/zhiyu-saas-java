'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ListChecks,
  ListOrdered,
  Save,
  SlidersHorizontal,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingView, useToast } from '@zhiyu/ui'
import { StatusBadge } from '@/components/shared/status-badge'
import { certApi, positionApi } from '@/lib/api'
import type { CertificationModelPoint, CertificationPositionModel } from '@/lib/types'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'
import { cn } from '@/lib/utils'
import { WeightConfigDialog } from './weight-config-dialog'
import { LevelConfigDialog } from './level-config-dialog'

function taskKey(abilityPointId: string, taskId: string): string {
  return `${abilityPointId}:${taskId}`
}

interface DomainPoint extends CertificationModelPoint {
  domainName: string
}

interface PositionWeightConfigProps {
  positionId: string
}

/** 岗位能力认定配置页：关联链全链只读，仅配置两级汇聚权重（任务→能力点、能力点→岗位总评） */
export function PositionWeightConfig({ positionId }: PositionWeightConfigProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [positionName, setPositionName] = useState('')
  const [model, setModel] = useState<CertificationPositionModel | null>(null)
  const [pointWeights, setPointWeights] = useState<Record<string, number>>({})
  const [taskWeights, setTaskWeights] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [pointDialogOpen, setPointDialogOpen] = useState(false)
  const [taskDialogPoint, setTaskDialogPoint] = useState<DomainPoint | null>(null)
  const [levelDialogPoint, setLevelDialogPoint] = useState<DomainPoint | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([positionApi.get(positionId), certApi.getPositionModel(positionId)])
      .then(([position, positionModel]) => {
        if (cancelled) return
        setPositionName(position.name)
        setModel(positionModel)
        // 后端总是带权重值（缺省时给均分默认），直接作为本地草稿初值
        const pw: Record<string, number> = {}
        const tw: Record<string, number> = {}
        positionModel.domains.forEach((domain) => {
          domain.points.forEach((point) => {
            pw[point.abilityPointId] = point.weight
            point.tasks.forEach((task) => {
              tw[taskKey(point.abilityPointId, task.taskId)] = task.weight
            })
          })
        })
        setPointWeights(pw)
        setTaskWeights(tw)
      })
      .catch((err) => {
        if (cancelled) return
        toast({
          title: '加载失败',
          description: err instanceof Error ? err.message : '获取岗位能力模型失败',
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [positionId, toast, reloadKey])

  const allPoints = useMemo<DomainPoint[]>(
    () =>
      (model?.domains ?? []).flatMap((domain) =>
        domain.points.map((point) => ({ ...point, domainName: domain.name })),
      ),
    [model],
  )

  const toggleExpanded = (abilityPointId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(abilityPointId)) next.delete(abilityPointId)
      else next.add(abilityPointId)
      return next
    })
  }

  const handleSave = async () => {
    const errors: string[] = []
    if (allPoints.length > 0) {
      const sum = allPoints.reduce((s, p) => s + (pointWeights[p.abilityPointId] ?? 0), 0)
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(`全部能力点权重合计为 ${sum}%，应为 100%`)
      }
    }
    for (const point of allPoints) {
      // 无关联任务的能力点不参与任务权重校验
      if (point.tasks.length === 0) continue
      const sum = point.tasks.reduce(
        (s, t) => s + (taskWeights[taskKey(point.abilityPointId, t.taskId)] ?? 0),
        0,
      )
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(`能力点「${point.name}」下任务权重合计为 ${sum}%，应为 100%`)
      }
    }
    if (errors.length > 0) {
      toast({ title: '权重校验未通过', description: errors.join('；'), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      await certApi.putPositionWeights(positionId, {
        pointWeights: allPoints.map((p) => ({
          abilityPointId: p.abilityPointId,
          weight: pointWeights[p.abilityPointId] ?? p.weight,
        })),
        taskWeights: allPoints.flatMap((p) =>
          p.tasks.map((t) => ({
            abilityPointId: p.abilityPointId,
            taskId: t.taskId,
            weight: taskWeights[taskKey(p.abilityPointId, t.taskId)] ?? t.weight,
          })),
        ),
      })
      toast({ title: '保存成功', description: '权重配置已保存' })
      setLoading(true)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast({
        title: '保存失败',
        description: err instanceof Error ? err.message : '保存权重配置失败',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingView text="加载岗位能力模型中..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/evaluation/job-ability">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            返回岗位列表
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{positionName || '岗位'}</h1>
          <StatusBadge status={model?.rule?.status ?? 'none'} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setPointDialogOpen(true)}
            disabled={allPoints.length === 0}
          >
            <SlidersHorizontal className="size-4" />
            能力点权重配置
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSave}
            disabled={saving || allPoints.length === 0}
          >
            <Save className="size-4" />
            {saving ? '保存中...' : '保存权重'}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        能力模型与任务关联来自岗位/场景编辑页，此处仅配置汇聚权重：任务得分按权重汇聚为能力点得分（点内合计
        100%），能力点得分按权重汇聚为岗位总评（岗位内合计 100%）。
      </p>

      {allPoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            该岗位尚未配置能力模型，请先在岗位编辑页配置能力模型与能力域
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[120px]">所属能力域</TableHead>
                    <TableHead className="w-[240px]">能力点名称</TableHead>
                    <TableHead className="w-[100px]">能力点权重</TableHead>
                    <TableHead className="w-[100px]">胜任标准</TableHead>
                    <TableHead>胜任标准描述</TableHead>
                    <TableHead className="w-[210px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(model?.domains ?? []).map((domain) =>
                    domain.points.map((point, idx) => {
                      const isExpanded = expanded.has(point.abilityPointId)
                      return (
                        <PointRows
                          key={point.abilityPointId}
                          point={point}
                          isExpanded={isExpanded}
                          pointWeight={pointWeights[point.abilityPointId] ?? point.weight}
                          taskWeights={taskWeights}
                          onToggle={() => toggleExpanded(point.abilityPointId)}
                          onOpenTaskWeights={() =>
                            setTaskDialogPoint({ ...point, domainName: domain.name })
                          }
                          domainName={domain.name}
                          domainCount={domain.points.length}
                          isFirstInDomain={idx === 0}
                          onOpenLevels={() =>
                            setLevelDialogPoint({ ...point, domainName: domain.name })
                          }
                        />
                      )
                    }),
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 页面级能力点权重弹窗：全部域的能力点按域分组展示，合计 100% */}
      <WeightConfigDialog
        open={pointDialogOpen}
        onOpenChange={setPointDialogOpen}
        title="能力点权重配置"
        description="配置各能力点得分占岗位总评的权重，岗位内全部能力点合计必须为 100%"
        items={allPoints.map((p) => ({
          id: p.abilityPointId,
          name: p.name,
          weight: pointWeights[p.abilityPointId] ?? p.weight,
          group: p.domainName,
        }))}
        onSave={(weights) => setPointWeights((prev) => ({ ...prev, ...weights }))}
      />

      {/* 单个能力点的任务权重弹窗：该点各任务合计 100% */}
      <WeightConfigDialog
        open={taskDialogPoint !== null}
        onOpenChange={(open) => {
          if (!open) setTaskDialogPoint(null)
        }}
        title={taskDialogPoint ? `任务权重配置 · ${taskDialogPoint.name}` : '任务权重配置'}
        description="配置各任务得分占该能力点得分的权重，合计必须为 100%"
        items={(taskDialogPoint?.tasks ?? []).map((t) => ({
          id: t.taskId,
          name: t.taskName,
          weight: taskDialogPoint
            ? (taskWeights[taskKey(taskDialogPoint.abilityPointId, t.taskId)] ?? t.weight)
            : t.weight,
          group: t.scenarioName,
        }))}
        onSave={(weights) => {
          if (!taskDialogPoint) return
          setTaskWeights((prev) => {
            const next = { ...prev }
            Object.entries(weights).forEach(([taskId, weight]) => {
              next[taskKey(taskDialogPoint.abilityPointId, taskId)] = weight
            })
            return next
          })
        }}
      />

      {/* 单个能力点的五档分数线弹窗 */}
      <LevelConfigDialog
        open={levelDialogPoint !== null}
        onOpenChange={(open) => {
          if (!open) setLevelDialogPoint(null)
        }}
        positionId={positionId}
        point={
          levelDialogPoint
            ? {
                abilityPointId: levelDialogPoint.abilityPointId,
                name: levelDialogPoint.name,
                levelMapping: levelDialogPoint.levelMapping,
              }
            : { abilityPointId: '', name: '' }
        }
        onSaved={() => {
          setLoading(true)
          setReloadKey((k) => k + 1)
        }}
      />
    </div>
  )
}

function PointRows({
  point,
  isExpanded,
  pointWeight,
  taskWeights,
  onToggle,
  onOpenTaskWeights,
  onOpenLevels,
  domainName,
  domainCount,
  isFirstInDomain,
}: {
  point: CertificationModelPoint
  isExpanded: boolean
  pointWeight: number
  taskWeights: Record<string, number>
  onToggle: () => void
  onOpenTaskWeights: () => void
  onOpenLevels: () => void
  domainName: string
  domainCount: number
  isFirstInDomain: boolean
}) {
  return (
    <>
      <TableRow>
        {isFirstInDomain && (
          <TableCell rowSpan={domainCount} className="align-middle">
            <div className="flex flex-col items-start gap-1">
              <Badge variant="outline" className="text-[10px]">
                {domainName}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{domainCount} 个能力点</span>
            </div>
          </TableCell>
        )}
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1.5 text-left text-sm font-medium"
          >
            {isExpanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="line-clamp-1">{point.name}</span>
          </button>
        </TableCell>
        <TableCell>
          <span className="text-sm font-medium">{pointWeight}%</span>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {COMPETENCY_LEVEL_LABELS[point.requiredLevel] ?? point.requiredLevel}
          </Badge>
        </TableCell>
        <TableCell className="max-w-[320px]">
          <span
            className="line-clamp-1 text-sm text-muted-foreground"
            title={point.rubricDescription}
          >
            {point.rubricDescription || point.description || '-'}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpenLevels}>
            <ListOrdered className="mr-1 size-3" />
            分档配置
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={onOpenTaskWeights}
            disabled={point.tasks.length === 0}
          >
            <ListChecks className="mr-1 size-3" />
            任务权重
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            {point.tasks.length === 0 ? (
              <p className="px-10 py-4 text-sm text-muted-foreground">
                暂无关联任务（请在场景编辑页关联能力点）
              </p>
            ) : (
              <div className="px-10 py-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务名称</TableHead>
                      <TableHead className="w-[200px]">所属场景</TableHead>
                      <TableHead className="w-[90px]">权重</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {point.tasks.map((task) => (
                      <TableRow key={task.taskId}>
                        <TableCell className="text-sm">{task.taskName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {task.scenarioName}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'text-sm',
                              taskWeights[taskKey(point.abilityPointId, task.taskId)] !==
                                undefined && 'font-medium',
                            )}
                          >
                            {taskWeights[taskKey(point.abilityPointId, task.taskId)] ?? task.weight}
                            %
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
