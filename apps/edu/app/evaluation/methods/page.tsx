"use client"

import { useState, useMemo } from "react"
import { Search, Link as LinkIcon, FileText, Pencil, ExternalLink, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useData } from "@/components/providers/data-provider"
import type { EvaluationMethod } from "@/lib/types"
import { PrdAnnotation } from "@/components/prd-annotation"
import { getAnnotation } from "@/lib/prd-annotations"

export default function EvaluationMethodsPage() {
  const {
    evaluationCategories,
    evaluationMethods,
    updateEvaluationMethod,
    getSceneTasksByMethod,
  } = useData()

  const [search, setSearch] = useState("")

  const filteredMethods = useMemo(() => {
    let methods = [...evaluationMethods]
    if (search.trim()) {
      const q = search.toLowerCase()
      methods = methods.filter((m) => m.name.toLowerCase().includes(q))
    }
    return methods
  }, [evaluationMethods, search])

  const getCategoryName = (categoryId: string) => {
    return evaluationCategories.find((c) => c.id === categoryId)?.name || '-'
  }

  const getCategoryOrder = (categoryId: string) => {
    return evaluationCategories.find((c) => c.id === categoryId)?.order || 0
  }

  // 按分类分组并排序
  const groupedMethods = useMemo(() => {
    const groups = new Map<string, EvaluationMethod[]>()
    filteredMethods.forEach((m) => {
      const list = groups.get(m.categoryId) || []
      list.push(m)
      groups.set(m.categoryId, list)
    })
    return Array.from(groups.entries()).sort((a, b) => getCategoryOrder(a[0]) - getCategoryOrder(b[0]))
  }, [filteredMethods])

  const handleToggle = (method: EvaluationMethod) => {
    updateEvaluationMethod(method.id, { enabled: !method.enabled })
  }

  // 场景任务弹窗
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [selectedMethodForTasks, setSelectedMethodForTasks] = useState<EvaluationMethod | null>(null)

  // 编辑弹窗
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<EvaluationMethod | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editLink, setEditLink] = useState("")

  const handleOpenTasks = (method: EvaluationMethod) => {
    setSelectedMethodForTasks(method)
    setTaskDialogOpen(true)
  }

  const handleOpenEdit = (method: EvaluationMethod) => {
    setEditingMethod(method)
    setEditDesc(method.description || "")
    setEditLink(method.docLink || "")
    setEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editingMethod) {
      updateEvaluationMethod(editingMethod.id, { description: editDesc, docLink: editLink })
      setEditDialogOpen(false)
      setEditingMethod(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">测评方式管理</h1>
        <p className="text-sm text-gray-500 mt-1">管理测评方式分类与前台展示状态</p>
      </div>

      {/* 搜索 */}
      <div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索测评方式名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 分类表格 */}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[120px]"><PrdAnnotation data={getAnnotation("em-col-category")}>一级分类</PrdAnnotation></TableHead>
              <TableHead className="w-[120px]"><PrdAnnotation data={getAnnotation("em-col-sub-category")}>二级分类</PrdAnnotation></TableHead>
              <TableHead className="w-[140px]"><PrdAnnotation data={getAnnotation("em-col-method")}>测评方式</PrdAnnotation></TableHead>
              <TableHead className="w-[90px] text-center"><PrdAnnotation data={getAnnotation("em-col-enabled")}>前台展示</PrdAnnotation></TableHead>
              <TableHead className="min-w-[200px]"><PrdAnnotation data={getAnnotation("em-col-description")}>测评方式说明</PrdAnnotation></TableHead>
              <TableHead className="w-[160px]"><PrdAnnotation data={getAnnotation("em-col-doc-link")}>文档链接</PrdAnnotation></TableHead>
              <TableHead className="w-[120px] text-center"><PrdAnnotation data={getAnnotation("em-col-tasks")}>管理场景任务</PrdAnnotation></TableHead>
              <TableHead className="w-[100px] text-right"><PrdAnnotation data={getAnnotation("em-col-actions")}>操作</PrdAnnotation></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedMethods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  暂无测评方式
                </TableCell>
              </TableRow>
            ) : (
              groupedMethods.flatMap(([categoryId, methods]) => {
                const categoryName = getCategoryName(categoryId)
                // 按二级分类再分组
                const subGroups = new Map<string, EvaluationMethod[]>()
                methods.forEach((m) => {
                  const sub = m.subCategoryName || '-'
                  const list = subGroups.get(sub) || []
                  list.push(m)
                  subGroups.set(sub, list)
                })
                const subGroupEntries = Array.from(subGroups.entries())
                let globalMethodIndex = 0
                return subGroupEntries.flatMap(([subName, subMethods]) => {
                  return subMethods.map((method, idx) => {
                    const taskCount = getSceneTasksByMethod(method.id).length
                    const isFirstOfCategory = globalMethodIndex === 0
                    const isFirstOfSub = idx === 0
                    globalMethodIndex++
                    return (
                      <TableRow key={method.id}>
                        {isFirstOfCategory && (
                          <TableCell
                            rowSpan={methods.length}
                            className="align-top font-medium bg-muted/10 border-r"
                          >
                            <Badge variant="outline" className="text-xs">{categoryName}</Badge>
                          </TableCell>
                        )}
                        {isFirstOfSub && (
                          <TableCell
                            rowSpan={subMethods.length}
                            className="align-top text-muted-foreground border-r"
                          >
                            <span className="text-sm">{subName}</span>
                          </TableCell>
                        )}
                        <TableCell>
                          <span className={`text-sm ${method.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {method.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={method.enabled}
                            onCheckedChange={() => handleToggle(method)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground line-clamp-2">
                            {method.description || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {method.docLink ? (
                            <a
                              href={method.docLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline truncate max-w-[160px]"
                            >
                              <ExternalLink className="size-3 shrink-0" />
                              <span className="truncate">{method.docLink}</span>
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => handleOpenTasks(method)}
                          >
                            {taskCount} 个任务
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(method)}>
                                编辑
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                })
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 场景任务列表弹窗 */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关联场景任务列表</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedMethodForTasks && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  测评方式：{selectedMethodForTasks.name}
                </p>
                {getSceneTasksByMethod(selectedMethodForTasks.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">暂无关联场景任务</p>
                ) : (
                  getSceneTasksByMethod(selectedMethodForTasks.id).map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{task.name}</p>
                        <p className="text-xs text-muted-foreground">{task.sceneName}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{task.methodIds.length} 个测评方式</Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑测评方式</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="mb-2 block text-sm font-medium">测评方式说明</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="请输入测评方式说明"
                rows={3}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">文档链接</label>
              <Input
                value={editLink}
                onChange={(e) => setEditLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
