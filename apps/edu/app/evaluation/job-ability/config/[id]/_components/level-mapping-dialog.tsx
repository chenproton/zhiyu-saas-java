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
import type { LevelMapping } from "@/lib/types"

interface LevelMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  mapping: LevelMapping[]
  onSave: (mapping: LevelMapping[]) => void
}

/** 等级映射配置弹窗：编辑各等级的分值区间 */
export function LevelMappingDialog({
  open,
  onOpenChange,
  title,
  description,
  mapping,
  onSave,
}: LevelMappingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，表单状态随每次打开重置 */}
        <LevelMappingForm
          mapping={mapping}
          onSave={onSave}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function LevelMappingForm({
  mapping,
  onSave,
  onCancel,
}: {
  mapping: LevelMapping[]
  onSave: (mapping: LevelMapping[]) => void
  onCancel: () => void
}) {
  const [localMapping, setLocalMapping] = useState<LevelMapping[]>(() =>
    mapping.map((m) => ({ ...m })),
  )

  const handleChange = (index: number, field: "min" | "max", value: string) => {
    const num = parseInt(value, 10)
    setLocalMapping((prev) =>
      prev.map((level, i) =>
        i === index ? { ...level, [field]: Number.isNaN(num) ? 0 : num } : level,
      ),
    )
  }

  const handleSave = () => {
    onSave(localMapping)
    onCancel()
  }

  return (
    <>
      <div className="py-4 space-y-3">
        {localMapping.map((level, index) => (
          <div
            key={`${level.level}-${index}`}
            className="flex items-center gap-3 p-3 rounded-md bg-secondary/50 border border-border"
          >
            <span className="w-20 font-medium text-sm">{level.level}</span>
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="number"
                min={0}
                max={100}
                value={level.min}
                onChange={(e) => handleChange(index, "min", e.target.value)}
                className="w-20 h-8 text-center"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={level.max}
                onChange={(e) => handleChange(index, "max", e.target.value)}
                className="w-20 h-8 text-center"
              />
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave}>保存</Button>
      </DialogFooter>
    </>
  )
}
