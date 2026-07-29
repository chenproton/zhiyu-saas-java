"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export interface WeightConfigItem {
  id: string
  name: string
  weight: number
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? "配置各子节点权重，合计必须为 100%"}
          </DialogDescription>
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，表单状态随每次打开重置 */}
        <WeightConfigForm
          items={items}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
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
  const [localWeights, setLocalWeights] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    items.forEach((item) => {
      map[item.id] = item.weight
    })
    return map
  })

  const total = Object.values(localWeights).reduce((sum, v) => sum + (v || 0), 0)
  const isValid = total === 100

  const handleChange = (id: string, value: string) => {
    const num = parseInt(value, 10)
    setLocalWeights((prev) => ({ ...prev, [id]: Number.isNaN(num) ? 0 : num }))
  }

  const handleSave = () => {
    if (!isValid) return
    onSave(localWeights)
    onCancel()
  }

  return (
    <>
      <div className="py-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无可配置项</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border"
            >
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={localWeights[item.id] ?? item.weight}
                  onChange={(e) => handleChange(item.id, e.target.value)}
                  className="w-20 h-8 text-center"
                />
                <span className="text-muted-foreground text-sm">%</span>
              </div>
            </div>
          ))
        )}
        {items.length > 0 && (
          <div
            className={`text-sm font-medium text-right ${
              isValid ? "text-green-600" : "text-red-600"
            }`}
          >
            当前合计：{total}% {isValid ? "✓" : "（必须为 100%）"}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={!isValid || items.length === 0}>
          保存
        </Button>
      </DialogFooter>
    </>
  )
}
