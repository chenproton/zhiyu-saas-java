"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@zhiyu/ui"
import { scenarioApi, taskApi } from "@/lib/api"
import type { Scenario, ScenarioTask } from "@/lib/types"

export interface SelectedTask {
  taskId: string
  taskName: string
  maxScore: number
}

interface TaskSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  careerPositionId: string
  /** 已关联的任务 id（列表中禁用勾选） */
  existingTaskIds: string[]
  onSelect: (tasks: SelectedTask[]) => void
}

/** 场景任务选择弹窗：先选场景，再勾选该场景下的任务 */
export function TaskSelectorDialog({
  open,
  onOpenChange,
  careerPositionId,
  existingTaskIds,
  onSelect,
}: TaskSelectorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>选择场景任务</DialogTitle>
          <DialogDescription>选择场景后勾选要关联的任务</DialogDescription>
        </DialogHeader>
        {/* DialogContent 仅在打开时挂载，选择状态随每次打开重置 */}
        <TaskSelectorBody
          careerPositionId={careerPositionId}
          existingTaskIds={existingTaskIds}
          onSelect={onSelect}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function TaskSelectorBody({
  careerPositionId,
  existingTaskIds,
  onSelect,
  onCancel,
}: {
  careerPositionId: string
  existingTaskIds: string[]
  onSelect: (tasks: SelectedTask[]) => void
  onCancel: () => void
}) {
  const { toast } = useToast()
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [scenarioId, setScenarioId] = useState("")
  const [taskData, setTaskData] = useState<{ scenarioId: string; tasks: ScenarioTask[] }>({
    scenarioId: "",
    tasks: [],
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // 仅展示当前场景已加载完成的任务，切换场景时避免显示旧数据
  const tasks = taskData.scenarioId === scenarioId ? taskData.tasks : []

  useEffect(() => {
    let cancelled = false
    const loadScenarios = async () => {
      setLoading(true)
      try {
        const res = await scenarioApi.list({ limit: 100 })
        if (cancelled) return
        // 优先展示关联本岗位的场景；若无匹配则展示全部
        const matched = res.items.filter((s) => s.careerPositionId === careerPositionId)
        const list = matched.length > 0 ? matched : res.items
        setScenarios(list)
        setScenarioId(list[0]?.id ?? "")
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "加载失败",
            description: err instanceof Error ? err.message : "获取场景列表失败",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadScenarios()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerPositionId])

  useEffect(() => {
    if (!scenarioId) return
    let cancelled = false
    const loadTasks = async () => {
      setLoading(true)
      try {
        const res = await taskApi.list({ scenarioId, limit: 200 })
        if (!cancelled) setTaskData({ scenarioId, tasks: res.items })
      } catch (err) {
        if (!cancelled) {
          toast({
            title: "加载失败",
            description: err instanceof Error ? err.message : "获取任务列表失败",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadTasks()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId])

  const toggleTask = (taskId: string) => {
    setSelectedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId],
    )
  }

  const handleConfirm = () => {
    const selected = tasks
      .filter((task) => selectedIds.includes(task.id))
      .map((task) => ({ taskId: task.id, taskName: task.name, maxScore: 100 }))
    onSelect(selected)
    onCancel()
  }

  return (
    <>
      <div className="py-4 space-y-4">
        <Select value={scenarioId} onValueChange={setScenarioId}>
          <SelectTrigger>
            <SelectValue placeholder="请选择场景" />
          </SelectTrigger>
          <SelectContent>
            {scenarios.map((scenario) => (
              <SelectItem key={scenario.id} value={scenario.id}>
                {scenario.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-md border border-border max-h-72 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">加载中...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {scenarioId ? "该场景下暂无任务" : "暂无可选场景"}
            </p>
          ) : (
            tasks.map((task) => {
              const existing = existingTaskIds.includes(task.id)
              return (
                <label
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 ${
                    existing ? "opacity-50" : "cursor-pointer hover:bg-secondary/50"
                  }`}
                >
                  <Checkbox
                    checked={existing || selectedIds.includes(task.id)}
                    disabled={existing}
                    onCheckedChange={() => toggleTask(task.id)}
                  />
                  <span className="flex-1 text-sm">{task.name}</span>
                  {existing && <span className="text-xs text-muted-foreground">已关联</span>}
                </label>
              )
            })
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>
          添加（{selectedIds.length}）
        </Button>
      </DialogFooter>
    </>
  )
}
