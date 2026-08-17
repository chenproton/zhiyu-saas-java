'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
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
import type {
  CertificationModelPoint,
  CertificationPositionModel,
  LevelMapping,
} from '@/lib/types'
import { COMPETENCY_LEVEL_LABELS } from '@/lib/types/job-source'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'
import { WeightConfigDialog } from './weight-config-dialog'
import { CombinedConfigDialog } from './combined-config-dialog'

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
  const t = useT()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [positionName, setPositionName] = useState('')
  const [model, setModel] = useState<CertificationPositionModel | null>(null)
  const [pointWeights, setPointWeights] = useState<Record<string, number>>({})
  const [taskWeights, setTaskWeights] = useState<Record<string, number>>({})
  const [pointDialogOpen, setPointDialogOpen] = useState(false)
  const [configPoint, setConfigPoint] = useState<DomainPoint | null>(null)
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
          title: t('加载失败'),
          description: err instanceof Error ? err.message : t('获取岗位能力模型失败'),
          variant: 'destructive',
        })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [positionId, toast, reloadKey, t])

  const allPoints = useMemo<DomainPoint[]>(
    () =>
      (model?.domains ?? []).flatMap((domain) =>
        domain.points.map((point) => ({ ...point, domainName: domain.name })),
      ),
    [model],
  )

  /** 两级权重合法性校验；可传入单点任务权重覆盖（合并弹窗保存时用） */
  const validateWeights = (pointTaskOverrides?: {
    abilityPointId: string
    weights: Record<string, number>
  }): string[] => {
    const errors: string[] = []
    if (allPoints.length > 0) {
      const sum = allPoints.reduce((s, p) => s + (pointWeights[p.abilityPointId] ?? 0), 0)
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(t('全部能力点权重合计为 {sum}%，应为 100%', { sum }))
      }
    }
    for (const point of allPoints) {
      // 无关联任务的能力点不参与任务权重校验
      if (point.tasks.length === 0) continue
      const tw =
        pointTaskOverrides?.abilityPointId === point.abilityPointId
          ? pointTaskOverrides.weights
          : taskWeights
      const sum = point.tasks.reduce(
        (s, task) => s + (tw[taskKey(point.abilityPointId, task.taskId)] ?? 0),
        0,
      )
      if (Math.abs(sum - 100) > 0.01) {
        errors.push(
          t('能力点「{name}」下任务权重合计为 {sum}%，应为 100%', { name: point.name, sum }),
        )
      }
    }
    return errors
  }

  const handleSave = async () => {
    const errors = validateWeights()
    if (errors.length > 0) {
      toast({ title: t('权重校验未通过'), description: errors.join('；'), variant: 'destructive' })
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
      toast({ title: t('保存成功'), description: t('权重配置已保存') })
      setLoading(true)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast({
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('保存权重配置失败'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  /** 合并弹窗保存：分档与权重立即持久化，返回是否成功（失败时弹窗停留） */
  const handleConfigSave = async (
    point: DomainPoint,
    pointTaskWeights: Record<string, number>,
    mapping: LevelMapping[],
  ): Promise<boolean> => {
    const errors = validateWeights({
      abilityPointId: point.abilityPointId,
      weights: pointTaskWeights,
    })
    if (errors.length > 0) {
      toast({ title: t('权重校验未通过'), description: errors.join('；'), variant: 'destructive' })
      return false
    }
    setSaving(true)
    try {
      await certApi.putPointLevels(positionId, point.abilityPointId, mapping)
      const tw: Record<string, number> = { ...taskWeights }
      Object.entries(pointTaskWeights).forEach(([taskId, weight]) => {
        tw[taskKey(point.abilityPointId, taskId)] = weight
      })
      setTaskWeights(tw)
      await certApi.putPositionWeights(positionId, {
        pointWeights: allPoints.map((p) => ({
          abilityPointId: p.abilityPointId,
          weight: pointWeights[p.abilityPointId] ?? p.weight,
        })),
        taskWeights: allPoints.flatMap((p) =>
          p.tasks.map((task) => ({
            abilityPointId: p.abilityPointId,
            taskId: task.taskId,
            weight: tw[taskKey(p.abilityPointId, task.taskId)] ?? task.weight,
          })),
        ),
      })
      toast({ title: t('保存成功'), description: t('胜任配置已保存') })
      setLoading(true)
      setReloadKey((k) => k + 1)
      return true
    } catch (err) {
      toast({
        title: t('保存失败'),
        description: err instanceof Error ? err.message : t('保存胜任配置失败'),
        variant: 'destructive',
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingView text={t('加载岗位能力模型中...')} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/evaluation/job-ability">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            {t('返回岗位列表')}
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{positionName || t('岗位')}</h1>
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
            {t('能力点权重配置')}
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={handleSave}
            disabled={saving || allPoints.length === 0}
          >
            <Save className="size-4" />
            {saving ? t('保存中...') : t('保存权重')}
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('能力模型与任务关联来自岗位/场景编辑页，此处仅配置汇聚权重：任务得分按权重汇聚为能力点得分（点内合计 100%），能力点得分按权重汇聚为岗位总评（岗位内合计 100%）。')}
      </p>

      {allPoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('该岗位尚未配置能力模型，请先在岗位编辑页配置能力模型与能力域')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[120px]">{t('所属能力域')}</TableHead>
                    <TableHead className="w-[240px]">{t('能力点名称')}</TableHead>
                    <TableHead className="w-[100px]">{t('能力点权重')}</TableHead>
                    <TableHead className="w-[100px]">{t('胜任标准')}</TableHead>
                    <TableHead>{t('胜任标准描述')}</TableHead>
                    <TableHead className="w-[260px]">{t('分数来源')}</TableHead>
                    <TableHead className="w-[210px] text-right">{t('操作')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(model?.domains ?? []).map((domain) =>
                    domain.points.map((point, idx) => (
                      <PointRows
                        key={point.abilityPointId}
                        point={point}
                        pointWeight={pointWeights[point.abilityPointId] ?? point.weight}
                        taskWeights={taskWeights}
                        onOpenConfig={() =>
                          setConfigPoint({ ...point, domainName: domain.name })
                        }
                        domainName={domain.name}
                        domainCount={domain.points.length}
                        isFirstInDomain={idx === 0}
                      />
                    )),
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
        title={t('能力点权重配置')}
        description={t('配置各能力点得分占岗位总评的权重，岗位内全部能力点合计必须为 100%')}
        items={allPoints.map((p) => ({
          id: p.abilityPointId,
          name: p.name,
          weight: pointWeights[p.abilityPointId] ?? p.weight,
          group: p.domainName,
        }))}
        onSave={(weights) => setPointWeights((prev) => ({ ...prev, ...weights }))}
      />

      {/* 单个能力点的合并胜任配置弹窗：左侧分数来源权重表格 + 右侧总分胜任标准转换 */}
      <CombinedConfigDialog
        open={configPoint !== null}
        onOpenChange={(open) => {
          if (!open) setConfigPoint(null)
        }}
        point={
          configPoint ?? { abilityPointId: '', name: '', tasks: [], levelMapping: undefined }
        }
        initialTaskWeights={Object.fromEntries(
          (configPoint?.tasks ?? []).map((task) => [
            task.taskId,
            configPoint
              ? (taskWeights[taskKey(configPoint.abilityPointId, task.taskId)] ?? task.weight)
              : task.weight,
          ]),
        )}
        onSave={
          configPoint
            ? (taskWeights, mapping) => handleConfigSave(configPoint, taskWeights, mapping)
            : async () => false
        }
      />
    </div>
  )
}

function PointRows({
  point,
  pointWeight,
  taskWeights,
  onOpenConfig,
  domainName,
  domainCount,
  isFirstInDomain,
}: {
  point: CertificationModelPoint
  pointWeight: number
  taskWeights: Record<string, number>
  onOpenConfig: () => void
  domainName: string
  domainCount: number
  isFirstInDomain: boolean
}) {
  const t = useT()
  const [tasksExpanded, setTasksExpanded] = useState(false)
  const hasMoreTasks = point.tasks.length > 5
  const visibleTasks = hasMoreTasks && !tasksExpanded ? point.tasks.slice(0, 5) : point.tasks
  return (
    <TableRow>
      {isFirstInDomain && (
        <TableCell rowSpan={domainCount} className="align-middle">
          <div className="flex flex-col items-start gap-1">
            <Badge variant="outline" className="text-[10px]">
              {domainName}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {t('{n} 个能力点', { n: domainCount })}
            </span>
          </div>
        </TableCell>
      )}
      <TableCell>
        <span className="text-sm font-medium">{point.name}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm font-medium">{pointWeight}%</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {t(COMPETENCY_LEVEL_LABELS[point.requiredLevel] ?? point.requiredLevel)}
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
      <TableCell className="align-top">
        {point.tasks.length === 0 ? (
          <span className="text-sm text-muted-foreground">{t('暂无关联任务')}</span>
        ) : (
          <>
            <div className="space-y-1.5">
              {visibleTasks.map((task) => (
                <div key={task.taskId} className="flex items-center gap-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" title={task.taskName}>
                      {task.taskName}
                    </span>
                    {task.scenarioName && (
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={task.scenarioName}
                      >
                        {task.scenarioName}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary',
                      taskWeights[taskKey(point.abilityPointId, task.taskId)] !== undefined &&
                        'font-semibold',
                    )}
                  >
                    {taskWeights[taskKey(point.abilityPointId, task.taskId)] ?? task.weight}%
                  </span>
                </div>
              ))}
            </div>
            {hasMoreTasks && (
              <button
                type="button"
                onClick={() => setTasksExpanded((prev) => !prev)}
                className="mt-1.5 flex items-center gap-0.5 text-xs text-primary"
              >
                <ChevronDown
                  className={cn('size-3 transition-transform', tasksExpanded && 'rotate-180')}
                />
                {tasksExpanded ? t('收起') : t('展开全部 {n} 项', { n: point.tasks.length })}
              </button>
            )}
          </>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onOpenConfig}>
          <SlidersHorizontal className="mr-1 size-3" />
          {t('胜任配置')}
        </Button>
      </TableCell>
    </TableRow>
  )
}
