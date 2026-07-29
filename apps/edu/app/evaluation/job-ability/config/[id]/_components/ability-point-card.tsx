"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { LevelMapping } from "@/lib/types"
import { RelatedTasksTable } from "./related-tasks-table"
import { TaskSelectorDialog, type SelectedTask } from "./task-selector-dialog"
import { LevelMappingDialog } from "./level-mapping-dialog"
import { WeightConfigDialog } from "./weight-config-dialog"
import { newKey, type DraftPoint } from "./types"

interface AbilityPointCardProps {
  point: DraftPoint
  careerPositionId: string
  globalMapping: LevelMapping[]
  levelOptions: string[]
  onChange: (point: DraftPoint) => void
  onDelete: () => void
}

/** 能力点行：主行展示能力点配置，可展开显示关联任务表格 */
export function AbilityPointCard({
  point,
  careerPositionId,
  globalMapping,
  levelOptions,
  onChange,
  onDelete,
}: AbilityPointCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [taskSelectorOpen, setTaskSelectorOpen] = useState(false)
  const [taskWeightOpen, setTaskWeightOpen] = useState(false)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const update = (patch: Partial<DraftPoint>) => onChange({ ...point, ...patch })

  const handleSelectTasks = (selected: SelectedTask[]) => {
    const noExisting = point.tasks.length === 0
    const base = noExisting && selected.length > 0 ? Math.floor(100 / selected.length) : 0
    const newTasks = selected.map((task, index) => ({
      key: newKey(),
      taskId: task.taskId,
      taskName: task.taskName,
      maxScore: task.maxScore,
      // 首次添加时均分 100，余数补给第一个任务
      weight: noExisting ? base + (index === 0 ? 100 - base * selected.length : 0) : 0,
    }))
    update({ tasks: [...point.tasks, ...newTasks] })
  }

  const handleSaveTaskWeights = (weights: Record<string, number>) => {
    update({
      tasks: point.tasks.map((task) =>
        weights[task.key] !== undefined ? { ...task, weight: weights[task.key] } : task,
      ),
    })
  }

  const requiredLevelOptions = levelOptions.includes(point.requiredLevel)
    ? levelOptions
    : [point.requiredLevel, ...levelOptions]

  return (
    <>
      <TableRow className="group">
        <TableCell>
          <button
            type="button"
            className="flex items-center gap-1 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium">{point.name}</span>
          </button>
        </TableCell>
        <TableCell>
          <Select
            value={point.requiredLevel}
            onValueChange={(value) => update({ requiredLevel: value })}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {requiredLevelOptions.map((level) => (
                <SelectItem key={level} value={level}>
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="text-center text-sm">{point.weight}%</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">
              {point.mappingType === "custom" ? "自定义" : "继承全局"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setMappingOpen(true)}
            >
              <Edit2 className="mr-1 h-3 w-3" />
              修改
            </Button>
            {point.mappingType === "custom" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => update({ mappingType: "inherit", customLevelMapping: undefined })}
              >
                恢复继承
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setTaskSelectorOpen(true)}
            >
              <Plus className="mr-1 h-3 w-3" />
              添加任务
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={point.tasks.length === 0}
              onClick={() => setTaskWeightOpen(true)}
            >
              任务权重
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={5} className="px-8 py-3">
            <RelatedTasksTable
              tasks={point.tasks}
              onChange={(tasks) => update({ tasks })}
              onOpenSelector={() => setTaskSelectorOpen(true)}
            />
          </TableCell>
        </TableRow>
      )}

      <TaskSelectorDialog
        open={taskSelectorOpen}
        onOpenChange={setTaskSelectorOpen}
        careerPositionId={careerPositionId}
        existingTaskIds={point.tasks.map((t) => t.taskId)}
        onSelect={handleSelectTasks}
      />
      <WeightConfigDialog
        open={taskWeightOpen}
        onOpenChange={setTaskWeightOpen}
        title="配置任务权重"
        items={point.tasks.map((t) => ({ id: t.key, name: t.taskName, weight: t.weight }))}
        onSave={handleSaveTaskWeights}
      />
      <LevelMappingDialog
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        title="配置自定义等级映射"
        description={`为能力点「${point.name}」配置自定义等级映射规则`}
        mapping={
          point.mappingType === "custom" && point.customLevelMapping
            ? point.customLevelMapping
            : globalMapping
        }
        onSave={(mapping) =>
          update({ mappingType: "custom", customLevelMapping: mapping })
        }
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除能力点"
        description={`确定要删除能力点「${point.name}」及其关联任务配置吗？保存后生效。`}
        variant="destructive"
        onConfirm={onDelete}
      />
    </>
  )
}
