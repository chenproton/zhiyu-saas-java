'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LevelMapping } from '@/lib/types'

interface LevelMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mapping: LevelMapping[]
  onSave: (mapping: LevelMapping[]) => void
  title?: string
  description?: string
  onOverride?: () => void
  overrideLabel?: string
}

export function LevelMappingDialog({
  open,
  onOpenChange,
  mapping,
  onSave,
  title = '编辑等级映射表',
  description = '设置各等级的分数区间，区间需连续且不重叠',
  onOverride,
  overrideLabel = '覆盖当前岗位所有能力点配置',
}: LevelMappingDialogProps) {
  const [localMapping, setLocalMapping] = useState<LevelMapping[]>(mapping)
  const [errors, setErrors] = useState<string[]>([])

  const handleMinChange = (index: number, value: string) => {
    const newMapping = [...localMapping]
    newMapping[index].min = parseInt(value) || 0
    setLocalMapping(newMapping)
  }

  const handleMaxChange = (index: number, value: string) => {
    const newMapping = [...localMapping]
    newMapping[index].max = parseInt(value) || 0
    setLocalMapping(newMapping)
  }

  const validateMapping = (): boolean => {
    const newErrors: string[] = []

    // 检查区间是否连续且不重叠
    for (let i = 0; i < localMapping.length; i++) {
      const current = localMapping[i]

      // 检查 min <= max
      if (current.min > current.max) {
        newErrors.push(`${current.level}: 最小值不能大于最大值`)
      }

      // 检查与下一个区间是否连续
      if (i < localMapping.length - 1) {
        const next = localMapping[i + 1]
        if (current.max + 1 !== next.min) {
          newErrors.push(`${current.level} 和 ${next.level}: 区间不连续`)
        }
      }
    }

    // 检查第一个区间从0开始
    if (localMapping[0].min !== 0) {
      newErrors.push('第一个区间应从0开始')
    }

    // 检查最后一个区间到100结束
    if (localMapping[localMapping.length - 1].max !== 100) {
      newErrors.push('最后一个区间应到100结束')
    }

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSave = () => {
    if (validateMapping()) {
      onSave(localMapping)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" annotationContext="level-mapping">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {localMapping.map((level, index) => (
            <div key={level.level} className="flex items-center gap-4">
              <Label className="w-16 shrink-0 text-right">{level.level}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={level.min}
                  onChange={(e) => handleMinChange(index, e.target.value)}
                  className="w-20"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={level.max}
                  onChange={(e) => handleMaxChange(index, e.target.value)}
                  className="w-20"
                />
              </div>
            </div>
          ))}

          {errors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {onOverride && (
            <Button variant="outline" className="text-amber-600 hover:text-amber-600" onClick={onOverride}>
              {overrideLabel}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
