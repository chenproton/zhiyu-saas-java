'use client'

import { useMemo, useState } from 'react'
import { Lock, RotateCcw, Scale, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FormDialogFooter } from '@zhiyu/ui'
import type { CertificationModelPoint, LevelMapping } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

/** 掌握程度五档（代码、标签、系统默认最低分 50/60/70/80/90） */
const LEVEL_ORDER: { level: string; label: string; defaultMin: number }[] = [
  { level: 'understand', label: '了解L1', defaultMin: 50 },
  { level: 'comprehend', label: '理解L2', defaultMin: 60 },
  { level: 'master', label: '掌握L3', defaultMin: 70 },
  { level: 'proficient', label: '熟练L4', defaultMin: 80 },
  { level: 'expert', label: '精通L5', defaultMin: 90 },
]

interface CombinedConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  point: Pick<CertificationModelPoint, 'abilityPointId' | 'name' | 'tasks' | 'levelMapping'>
  /** 父组件权重草稿（taskId → weight），未保存过的任务用 task.weight */
  initialTaskWeights: Record<string, number>
  /** 保存（返回 false 表示失败，弹窗停留） */
  onSave: (taskWeights: Record<string, number>, levelMapping: LevelMapping[]) => Promise<boolean>
}

/** 单能力点胜任配置弹窗：左侧分数来源（任务）权重表格 + 右侧总分胜任标准五档转换，保存即持久化 */
export function CombinedConfigDialog({
  open,
  onOpenChange,
  point,
  initialTaskWeights,
  onSave,
}: CombinedConfigDialogProps) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>{t('胜任配置 · {name}', { name: point.name })}</DialogTitle>
          <DialogDescription>
            {t('配置分数来源权重与总分胜任标准转换，保存后立即生效')}
          </DialogDescription>
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，表单状态随每次打开从最新 point 重置 */}
        <CombinedConfigForm
          point={point}
          initialTaskWeights={initialTaskWeights}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CombinedConfigForm({
  point,
  initialTaskWeights,
  onSave,
  onCancel,
}: {
  point: CombinedConfigDialogProps['point']
  initialTaskWeights: Record<string, number>
  onSave: CombinedConfigDialogProps['onSave']
  onCancel: () => void
}) {
  const t = useT()
  const [taskWeights, setTaskWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    point.tasks.forEach((task) => {
      map[task.taskId] = initialTaskWeights[task.taskId] ?? task.weight
    })
    return map
  })
  const [locked, setLocked] = useState<Record<string, boolean>>({})
  const [mins, setMins] = useState<number[]>(() => {
    const configured = point.levelMapping ?? []
    if (configured.length === LEVEL_ORDER.length) {
      return configured.map((m) => m.min)
    }
    return LEVEL_ORDER.map((l) => l.defaultMin)
  })
  const [saving, setSaving] = useState(false)

  const taskTotal = Object.values(taskWeights).reduce((sum, v) => sum + (v || 0), 0)
  const hasTasks = point.tasks.length > 0
  const taskTotalValid = !hasTasks || taskTotal === 100

  const levelRows = useMemo(
    () =>
      LEVEL_ORDER.map((l, i) => {
        const min = mins[i] ?? l.defaultMin
        const max =
          i === LEVEL_ORDER.length - 1 ? 100 : (mins[i + 1] ?? LEVEL_ORDER[i + 1].defaultMin) - 1
        return { ...l, min, max }
      }),
    [mins],
  )

  const levelError = useMemo(() => {
    for (let i = 0; i < levelRows.length; i++) {
      const r = levelRows[i]
      if (!Number.isInteger(r.min) || r.min < 1 || r.min > 100) {
        return '各档位最低分必须为 1-100 的整数'
      }
      if (i > 0 && r.min <= levelRows[i - 1].min) {
        return '各档位最低分必须严格递增'
      }
    }
    return null
  }, [levelRows])

  const handleTaskWeightChange = (taskId: string, value: string) => {
    const num = parseInt(value, 10)
    setTaskWeights((prev) => ({ ...prev, [taskId]: Number.isNaN(num) ? 0 : num }))
  }

  const toggleLock = (taskId: string) => {
    setLocked((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const distribute = () => {
    const unlocked = point.tasks.filter((task) => !locked[task.taskId])
    if (unlocked.length === 0) return
    const lockedWeight = point.tasks
      .filter((task) => locked[task.taskId])
      .reduce((sum, task) => sum + (taskWeights[task.taskId] ?? 0), 0)
    const remaining = 100 - lockedWeight
    const each = Math.floor(remaining / unlocked.length)
    setTaskWeights((prev) => {
      const next = { ...prev }
      unlocked.forEach((task, i) => {
        next[task.taskId] = each + (i < remaining % unlocked.length ? 1 : 0)
      })
      return next
    })
  }

  const resetDefault = () => setMins(LEVEL_ORDER.map((l) => l.defaultMin))

  const handleLevelChange = (index: number, value: string) => {
    const num = parseInt(value, 10)
    setMins((prev) => {
      const next = [...prev]
      next[index] = Number.isNaN(num) ? 0 : num
      return next
    })
  }

  const handleSave = async () => {
    if (!taskTotalValid || levelError) return
    const mapping: LevelMapping[] = levelRows.map((r) => ({
      level: r.level,
      min: r.min,
      max: r.max,
    }))
    setSaving(true)
    try {
      const ok = await onSave(taskWeights, mapping)
      if (ok) onCancel()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      className="grid gap-4"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {/* 左栏：分数来源权重 */}
        <div className="flex min-h-0 flex-col">
          <p className="text-sm font-semibold">{t('分数来源权重')}</p>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            {t('各任务得分占该能力点得分的权重，合计必须为 100%')}
          </p>
          {!hasTasks ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              {t('暂无关联任务（请在场景编辑页关联能力点）')}
            </p>
          ) : (
            <>
              <div className="max-h-[38vh] overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>{t('任务名称')}</TableHead>
                      <TableHead className="w-[110px]">{t('权重(%)')}</TableHead>
                      <TableHead className="w-[56px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {point.tasks.map((task) => (
                      <TableRow key={task.taskId}>
                        <TableCell className="max-w-[240px] text-sm">
                          <span className="block truncate" title={task.taskName}>
                            {task.taskName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={taskWeights[task.taskId] ?? task.weight}
                            onChange={(e) => handleTaskWeightChange(task.taskId, e.target.value)}
                            disabled={locked[task.taskId]}
                            className={cn(
                              'h-8 w-20 text-center',
                              locked[task.taskId] && 'bg-gray-50',
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleLock(task.taskId)}
                            className={cn(
                              'h-8 w-8',
                              locked[task.taskId] ? 'text-amber-500' : 'text-gray-400',
                            )}
                          >
                            {locked[task.taskId] ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Unlock className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={distribute}>
                  <Scale className="mr-2 h-4 w-4" />
                  {t('一键平均分配')}
                </Button>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    taskTotalValid ? 'text-green-600' : 'text-red-600',
                  )}
                >
                  {t('合计：{total}%', { total: taskTotal })}{' '}
                  {taskTotalValid ? '✓' : t('（必须为 100%）')}
                </span>
              </div>
            </>
          )}
        </div>

        {/* 右栏：总分胜任标准转换 */}
        <div className="min-h-0 border-t pt-5 md:border-l md:border-t-0 md:pl-6">
          <p className="text-sm font-semibold">{t('总分胜任标准转换')}</p>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            {t('配置各档位最低分数线，低于最低档判定为「未达标」')}
          </p>
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
              <span className="w-20 text-sm font-medium">{t('未达标')}</span>
              <span className="text-sm text-muted-foreground">
                {levelRows.length > 0 ? t('0 ~ {max} 分', { max: levelRows[0].min - 1 }) : '—'}
              </span>
            </div>
            {levelRows.map((row, i) => (
              <div
                key={row.level}
                className="flex items-center gap-3 rounded-md border border-border bg-secondary/50 p-3"
              >
                <span className="w-20 text-sm font-medium">{t(row.label)}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={row.min}
                    onChange={(e) => handleLevelChange(i, e.target.value)}
                    className="h-8 w-20 text-center"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t('~ {max} 分', { max: row.max })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={resetDefault}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('恢复默认（50/60/70/80/90）')}
            </Button>
            <span className={cn('text-xs', levelError ? 'text-red-600' : 'text-muted-foreground')}>
              {levelError ? t(levelError) : t('档位区间连续覆盖 1-100 分')}
            </span>
          </div>
        </div>
      </div>

      <FormDialogFooter
        onCancel={onCancel}
        loading={saving}
        confirmDisabled={!taskTotalValid || !!levelError}
      />
    </form>
  )
}
