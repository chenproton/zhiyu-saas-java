// @ts-nocheck
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ChevronDown,
  ChevronUp,
  Settings,
  ExternalLink,
  AlertCircle,
  Eye,
} from 'lucide-react'
import {
  type EvalAbilityPoint,
  type LevelMapping,
  defaultLevelMapping,
} from '@/lib/types'
import { RelatedTasksTable } from './related-tasks-table'
import { LevelMappingDialog } from './level-mapping-dialog'
import { LevelMappingDisplay } from './level-mapping-display'
import { cn } from '@/lib/utils'

interface AbilityPointCardProps {
  point: EvalAbilityPoint
  globalMapping: LevelMapping[]
  onPointChange: (point: EvalAbilityPoint) => void
  disabled?: boolean
}

export function AbilityPointCard({
  point,
  globalMapping,
  onPointChange,
  disabled = false,
}: AbilityPointCardProps) {
  const [showDescription, setShowDescription] = useState(false)
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false)
  const [viewGlobalDialogOpen, setViewGlobalDialogOpen] = useState(false)

  const currentMapping =
    point.mappingType === 'custom' && point.customMapping
      ? point.customMapping
      : globalMapping

  const handleMappingTypeChange = (value: 'inherit' | 'custom') => {
    onPointChange({
      ...point,
      mappingType: value,
      customMapping: value === 'custom' ? [...globalMapping] : undefined,
    })
  }

  const handleMappingSave = (mapping: LevelMapping[]) => {
    onPointChange({
      ...point,
      customMapping: mapping,
    })
  }

  const handleTasksChange = (
    tasks: EvalAbilityPoint['relatedTasks'],
  ) => {
    onPointChange({
      ...point,
      relatedTasks: tasks,
    })
  }

  const hasNoTasks = point.relatedTasks.length === 0

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        disabled && 'opacity-60',
      )}
    >
      {/* 能力点头部 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h4 className="font-medium text-foreground">{point.name}</h4>
            {hasNoTasks && (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-50 text-amber-600"
              >
                <AlertCircle className="mr-1 size-3" />
                暂未关联任务
              </Badge>
            )}
          </div>

          <button
            onClick={() => setShowDescription(!showDescription)}
            className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            disabled={disabled}
          >
            查看详情
            {showDescription ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>

          {showDescription && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {point.description}
            </p>
          )}
        </div>

        {/* 映射表选择器 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">等级映射:</span>
          <Select
            value={point.mappingType}
            onValueChange={(value: 'inherit' | 'custom') =>
              handleMappingTypeChange(value)
            }
            disabled={disabled}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">继承全局</SelectItem>
              <SelectItem value="custom">自定义映射</SelectItem>
            </SelectContent>
          </Select>

          {point.mappingType === 'inherit' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewGlobalDialogOpen(true)}
              className="gap-1 text-muted-foreground"
            >
              <Eye className="size-4" />
              查看全局规则
            </Button>
          )}

          {point.mappingType === 'custom' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMappingDialogOpen(true)}
              disabled={disabled}
              className="size-8"
            >
              <Settings className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 任务列表或空状态 */}
      <div className="mt-4">
        {hasNoTasks ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/30 p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">
              该能力点暂未关联任务，无法计算掌握程度
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="#" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 size-4" />
                前往任务模块关联
              </a>
            </Button>
          </div>
        ) : (
          <RelatedTasksTable
            tasks={point.relatedTasks}
            mapping={currentMapping}
            onTasksChange={handleTasksChange}
            disabled={disabled}
          />
        )}
      </div>

      {/* 映射编辑弹窗 */}
      <LevelMappingDialog
        open={mappingDialogOpen}
        onOpenChange={setMappingDialogOpen}
        mapping={point.customMapping || defaultLevelMapping}
        onSave={handleMappingSave}
        title={`编辑 "${point.name}" 映射表`}
      />

      {/* 查看全局规则弹窗 */}
      <Dialog open={viewGlobalDialogOpen} onOpenChange={setViewGlobalDialogOpen}>
        <DialogContent size="sm" annotationContext="ability-point">
          <DialogHeader>
            <DialogTitle>全局等级映射规则</DialogTitle>
            <DialogDescription>查看该能力点的全局等级映射规则</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <LevelMappingDisplay mapping={globalMapping} />
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewGlobalDialogOpen(false)}>
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
