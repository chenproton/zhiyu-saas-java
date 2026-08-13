'use client'

import { useState } from 'react'
import { Lock, Scale, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FormDialogFooter } from '@zhiyu/ui'
import { useT } from '@/lib/i18n/locale-provider'

export interface WeightConfigItem {
  id: string
  name: string
  weight: number
  /** 可选分组名（相邻同组项只显示一次分组标题） */
  group?: string
}

interface WeightConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  items: WeightConfigItem[]
  onSave: (weights: Record<string, number>) => void
}

/** 通用权重配置弹窗：各子节点权重合计必须为 100% */
export function WeightConfigDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  onSave,
}: WeightConfigDialogProps) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? t('配置各子节点权重，合计必须为 100%')}
          </DialogDescription>
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，表单状态随每次打开重置 */}
        <WeightConfigForm items={items} onSave={onSave} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function WeightConfigForm({
  items,
  onSave,
  onCancel,
}: {
  items: WeightConfigItem[]
  onSave: (weights: Record<string, number>) => void
  onCancel: () => void
}) {
  const t = useT()
  const [localWeights, setLocalWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    items.forEach((item) => {
      map[item.id] = item.weight
    })
    return map
  })
  // 锁定的项保持权重不变，平均分配时只重新分配未锁定项
  const [locked, setLocked] = useState<Record<string, boolean>>({})

  const total = Object.values(localWeights).reduce((sum, v) => sum + (v || 0), 0)
  const isValid = total === 100

  const handleChange = (id: string, value: string) => {
    const num = parseInt(value, 10)
    setLocalWeights((prev) => ({ ...prev, [id]: Number.isNaN(num) ? 0 : num }))
  }

  const toggleLock = (id: string) => {
    setLocked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const distribute = () => {
    const unlocked = items.filter((item) => !locked[item.id])
    if (unlocked.length === 0) return
    const lockedWeight = items
      .filter((item) => locked[item.id])
      .reduce((sum, item) => sum + (localWeights[item.id] ?? 0), 0)
    const remaining = 100 - lockedWeight
    const each = Math.floor(remaining / unlocked.length)
    setLocalWeights((prev) => {
      const next = { ...prev }
      unlocked.forEach((item, i) => {
        next[item.id] = each + (i < remaining % unlocked.length ? 1 : 0)
      })
      return next
    })
  }

  const handleSave = () => {
    if (!isValid) return
    onSave(localWeights)
    onCancel()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSave()
      }}
      className="grid gap-4"
    >
      <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('暂无可配置项')}</p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span
                className={cn('text-sm font-semibold', isValid ? 'text-green-600' : 'text-red-600')}
              >
                {t('当前合计：{total}%', { total })} {isValid ? '✓' : t('（必须为 100%）')}
              </span>
              <Button variant="outline" size="sm" onClick={distribute}>
                <Scale className="mr-2 h-4 w-4" />
                {t('一键平均分配')}
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={item.id} className="space-y-3">
                {item.group && (index === 0 || items[index - 1].group !== item.group) && (
                  <p className="text-xs font-medium text-muted-foreground">{item.group}</p>
                )}
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border">
                  <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={localWeights[item.id] ?? item.weight}
                      onChange={(e) => handleChange(item.id, e.target.value)}
                      disabled={locked[item.id]}
                      className={cn('w-20 h-8 text-center', locked[item.id] && 'bg-gray-50')}
                    />
                    <span className="text-muted-foreground text-sm">%</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleLock(item.id)}
                    className={cn('h-8 w-8', locked[item.id] ? 'text-amber-500' : 'text-gray-400')}
                  >
                    {locked[item.id] ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <FormDialogFooter
        onCancel={onCancel}
        confirmDisabled={!isValid || items.length === 0}
      />
    </form>
  )
}
