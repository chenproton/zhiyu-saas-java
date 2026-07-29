"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { DraftTask } from "./types"

interface RelatedTasksTableProps {
  tasks: DraftTask[]
  onChange: (tasks: DraftTask[]) => void
  onOpenSelector: () => void
}

/** 能力点下的关联任务表格：满分可编辑，权重通过任务权重弹窗统一配置 */
export function RelatedTasksTable({ tasks, onChange, onOpenSelector }: RelatedTasksTableProps) {
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const weightSum = tasks.reduce((sum, t) => sum + (t.weight || 0), 0)

  const handleMaxScoreChange = (key: string, value: string) => {
    const num = parseInt(value, 10)
    onChange(
      tasks.map((t) =>
        t.key === key ? { ...t, maxScore: Number.isNaN(num) ? 0 : num } : t,
      ),
    )
  }

  const handleDelete = () => {
    if (!deletingKey) return
    onChange(tasks.filter((t) => t.key !== deletingKey))
    setDeletingKey(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          关联任务（权重合计：
          <span className={weightSum === 100 || tasks.length === 0 ? "text-green-600" : "text-red-600"}>
            {weightSum}%
          </span>
          ）
        </span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onOpenSelector}>
          <Plus className="mr-1 h-3 w-3" />
          添加任务
        </Button>
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-md">
          暂未关联任务
        </p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-transparent">
                <TableHead className="text-xs font-medium">任务名</TableHead>
                <TableHead className="w-[110px] text-center text-xs font-medium">满分</TableHead>
                <TableHead className="w-[90px] text-center text-xs font-medium">权重</TableHead>
                <TableHead className="w-[70px] text-right text-xs font-medium">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.key}>
                  <TableCell className="text-sm text-primary">{task.taskName}</TableCell>
                  <TableCell className="text-center">
                    <Input
                      type="number"
                      min={0}
                      value={task.maxScore}
                      onChange={(e) => handleMaxScoreChange(task.key, e.target.value)}
                      className="w-20 h-7 mx-auto text-center text-sm px-1"
                    />
                  </TableCell>
                  <TableCell className="text-center text-sm">{task.weight}%</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                      onClick={() => setDeletingKey(task.key)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deletingKey !== null}
        onOpenChange={(open) => !open && setDeletingKey(null)}
        title="删除关联任务"
        description="确定要移除该关联任务吗？保存后生效。"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
