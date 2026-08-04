'use client'

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@zhiyu/ui'
import { certApi } from '@/lib/api'
import type { LevelMapping } from '@zhiyu/shared-types'
import { cn } from '@/lib/utils'

/** 掌握程度五档（代码、标签、系统默认最低分 60/70/80/90/100） */
const LEVEL_ORDER: { level: string; label: string; defaultMin: number }[] = [
  { level: 'understand', label: '了解L1', defaultMin: 60 },
  { level: 'comprehend', label: '理解L2', defaultMin: 70 },
  { level: 'master', label: '掌握L3', defaultMin: 80 },
  { level: 'proficient', label: '熟练L4', defaultMin: 90 },
  { level: 'expert', label: '精通L5', defaultMin: 100 },
]

interface LevelConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positionId: string
  point: { abilityPointId: string; name: string; levelMapping?: LevelMapping[] }
  /** 保存成功回调（父组件 reload 模型回显） */
  onSaved: () => void
}

/** 能力点五档分数线配置弹窗：未达标自动为低于最低档，档位区间连续覆盖 1-100 */
export function LevelConfigDialog({
  open,
  onOpenChange,
  positionId,
  point,
  onSaved,
}: LevelConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>能力点分档配置 · {point.name}</DialogTitle>
          <DialogDescription>
            配置该能力点各档位最低分数线，低于最低档判定为「未达标」；修改后需在结果页重新触发汇聚生效
          </DialogDescription>
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，表单状态随每次打开从最新 point 重置 */}
        <LevelConfigForm
          positionId={positionId}
          point={point}
          onSaved={onSaved}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function LevelConfigForm({
  positionId,
  point,
  onSaved,
  onCancel,
}: {
  positionId: string
  point: { abilityPointId: string; name: string; levelMapping?: LevelMapping[] }
  onSaved: () => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [mins, setMins] = useState<number[]>(() => {
    const configured = point.levelMapping ?? []
    if (configured.length === LEVEL_ORDER.length) {
      return configured.map((m) => m.min)
    }
    return LEVEL_ORDER.map((l) => l.defaultMin)
  })
  const [saving, setSaving] = useState(false)

  const rows = useMemo(
    () =>
      LEVEL_ORDER.map((l, i) => {
        const min = mins[i] ?? l.defaultMin
        const max = i === LEVEL_ORDER.length - 1 ? 100 : (mins[i + 1] ?? LEVEL_ORDER[i + 1].defaultMin) - 1
        return { ...l, min, max }
      }),
    [mins],
  )

  const error = useMemo(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!Number.isInteger(r.min) || r.min < 1 || r.min > 100) {
        return '各档位最低分必须为 1-100 的整数'
      }
      if (i > 0 && r.min <= rows[i - 1].min) {
        return '各档位最低分必须严格递增'
      }
    }
    return null
  }, [rows])

  const handleChange = (index: number, value: string) => {
    const num = parseInt(value, 10)
    setMins((prev) => {
      const next = [...prev]
      next[index] = Number.isNaN(num) ? 0 : num
      return next
    })
  }

  const resetDefault = () => setMins(LEVEL_ORDER.map((l) => l.defaultMin))

  const handleSave = async () => {
    if (error) return
    const mapping: LevelMapping[] = rows.map((r) => ({ level: r.level, min: r.min, max: r.max }))
    setSaving(true)
    try {
      await certApi.putPointLevels(positionId, point.abilityPointId, mapping)
      toast({ title: '保存成功', description: '分档配置已保存，重新汇聚后生效' })
      onSaved()
      onCancel()
    } catch (err) {
      toast({
        title: '保存失败',
        description: err instanceof Error ? err.message : '保存分档配置失败',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="py-2 space-y-2.5">
        <div className="flex items-center gap-3 p-3 rounded-md bg-muted/40 border border-border">
          <span className="w-20 text-sm font-medium">未达标</span>
          <span className="text-sm text-muted-foreground">
            {rows.length > 0 ? `0 ~ ${rows[0].min - 1} 分` : '—'}
          </span>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.level}
            className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border"
          >
            <span className="w-20 text-sm font-medium">{row.label}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                value={row.min}
                onChange={(e) => handleChange(i, e.target.value)}
                className="w-20 h-8 text-center"
              />
              <span className="text-muted-foreground text-sm">~ {row.max} 分</span>
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" onClick={resetDefault}>
            <RotateCcw className="mr-2 h-4 w-4" />
            恢复默认（60/70/80/90/100）
          </Button>
          <span className={cn('text-xs', error ? 'text-red-600' : 'text-muted-foreground')}>
            {error ?? '档位区间连续覆盖 1-100 分'}
          </span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={!!error || saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </DialogFooter>
    </>
  )
}
