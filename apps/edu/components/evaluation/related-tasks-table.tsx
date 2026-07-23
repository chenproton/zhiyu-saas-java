// @ts-nocheck
'use client'

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Trash2, Lock, Settings } from 'lucide-react'
import {
  type RelatedTask,
  type LevelMapping,
  calculateLevel,
  defaultLevelMapping,
} from '@/lib/types'
import { LevelMappingDisplay } from './level-mapping-display'
import { cn } from '@/lib/utils'

// 扩展任务类型，支持自定义映射
interface RelatedTaskWithMapping extends RelatedTask {
  customMapping?: LevelMapping[]
  mappingType?: 'inherit' | 'custom'
}

interface RelatedTasksTableProps {
  tasks: RelatedTaskWithMapping[]
  mapping: LevelMapping[]
  onTasksChange: (tasks: RelatedTaskWithMapping[]) => void
  disabled?: boolean
}

export function RelatedTasksTable({
  tasks,
  mapping,
  onTasksChange,
  disabled = false,
}: RelatedTasksTableProps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingMapping, setEditingMapping] = useState<LevelMapping[]>([])

  // 计算权重合计
  const totalWeight = useMemo(() => {
    return tasks.reduce((sum, task) => sum + task.weight, 0)
  }, [tasks])

  // 计算预览掌握程度（理论最高分）
  const previewLevel = useMemo(() => {
    if (tasks.length === 0 || totalWeight !== 100) return null

    // 计算加权满分
    const weightedMaxScore = tasks.reduce((sum, task) => {
      return sum + (task.maxScore * task.weight) / 100
    }, 0)

    // 归一化到 0-100
    const normalizedScore = Math.min(100, weightedMaxScore)

    return calculateLevel(normalizedScore, mapping)
  }, [tasks, totalWeight, mapping])

  const handleWeightChange = (taskId: string, value: string) => {
    const weight = Math.max(0, Math.min(100, parseInt(value) || 0))
    const newTasks = tasks.map((task) =>
      task.id === taskId ? { ...task, weight } : task,
    )
    onTasksChange(newTasks)
  }

  const handleRemoveTask = (taskId: string) => {
    onTasksChange(tasks.filter((task) => task.id !== taskId))
  }

  const handleOpenMappingEdit = (task: RelatedTaskWithMapping) => {
    setEditingTaskId(task.id)
    setEditingMapping(task.customMapping || [...defaultLevelMapping])
  }

  const handleSaveTaskMapping = () => {
    if (!editingTaskId) return
    const newTasks = tasks.map((task) =>
      task.id === editingTaskId
        ? { ...task, customMapping: editingMapping, mappingType: 'custom' as const }
        : task,
    )
    onTasksChange(newTasks)
    setEditingTaskId(null)
  }

  const handleMappingValueChange = (index: number, field: 'min' | 'max', value: string) => {
    const numValue = parseInt(value) || 0
    setEditingMapping(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: numValue } : item
      )
    )
  }

  const isWeightInvalid = tasks.length > 0 && totalWeight !== 100

  const editingTask = tasks.find(t => t.id === editingTaskId)

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-muted-foreground">关联任务名称</TableHead>
            <TableHead className="w-28 text-muted-foreground">任务满分</TableHead>
            <TableHead className="w-32 text-muted-foreground">权重 (%)</TableHead>
            <TableHead className="w-28 text-muted-foreground">自定义映射</TableHead>
            <TableHead className="w-20 text-muted-foreground">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="border-border/50">
              <TableCell>
                <div className="flex items-center gap-2">
                  <Lock className="size-3 text-muted-foreground/50" />
                  <span>{task.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Lock className="size-3 text-muted-foreground/50" />
                  <span className="text-muted-foreground">{task.maxScore}</span>
                </div>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={task.weight}
                  onChange={(e) => handleWeightChange(task.id, e.target.value)}
                  disabled={disabled}
                  className="w-20"
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenMappingEdit(task)}
                  disabled={disabled}
                  className={cn(
                    "gap-1 text-xs",
                    task.mappingType === 'custom' ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Settings className="size-3" />
                  {task.mappingType === 'custom' ? '已自定义' : '配置'}
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveTask(task.id)}
                  disabled={disabled}
                  className="size-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* 底部统计 */}
      <div className="flex items-center justify-between rounded-md bg-secondary/50 px-4 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div
            className={cn(
              'flex items-center gap-2',
              isWeightInvalid && 'text-destructive',
            )}
          >
            <span className="text-muted-foreground">权重合计:</span>
            <span className="font-medium">{totalWeight}%</span>
            {isWeightInvalid && <span className="text-xs">（需等于100%）</span>}
          </div>
          {previewLevel && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">预览掌握程度:</span>
              <span className="font-medium text-primary">{previewLevel}</span>
            </div>
          )}
        </div>
      </div>

      {/* 任务自定义映射编辑弹窗 */}
      <Dialog open={!!editingTaskId} onOpenChange={(open) => !open && setEditingTaskId(null)}>
        <DialogContent annotationContext="related-tasks">
          <DialogHeader>
            <DialogTitle>
              编辑「{editingTask?.name}」等级映射
            </DialogTitle>
            <DialogDescription>
              自定义该任务的等级映射规则，仅影响此任务的掌握程度计算
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              {editingMapping.map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                  <span className="w-16 text-sm font-medium">{item.level}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.min}
                      onChange={(e) => handleMappingValueChange(index, 'min', e.target.value)}
                      className="w-20"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.max}
                      onChange={(e) => handleMappingValueChange(index, 'max', e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">分</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTaskId(null)}>
              取消
            </Button>
            <Button onClick={handleSaveTaskMapping}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
