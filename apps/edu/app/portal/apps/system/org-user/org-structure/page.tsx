"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Plus,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Users,
  Upload,
  Download,
  GraduationCap,
  School,
  Building2,
  BookOpen,
  Briefcase,
  LayoutList,
  Building,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { orgApi, orgTypeApi, portalUserManagementApi } from "@/lib/api"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { Organization, OrgType } from "@/lib/types/backend"
import { usePortalAuth } from "@/contexts/portal-auth-context"
import { useToast } from "@/hooks/use-toast"

type OrgNodeType = string

interface OrgNode {
  id: string
  name: string
  type: OrgNodeType
  typeId: string
  parentId?: string
  order: number
  memberCount: number
  children?: OrgNode[]
  expanded?: boolean
}

function countByType(nodes: OrgNode[], type: OrgNodeType): number {
  let count = 0
  nodes.forEach((node) => {
    if (node.type === type) count += 1
    if (node.children) count += countByType(node.children, type)
  })
  return count
}

function totalMembers(nodes: OrgNode[]): number {
  return nodes.reduce((sum, node) => sum + node.memberCount, 0)
}

function typeMetaFor(typeName: string): { icon: React.ElementType; color: string; badge: string } {
  const map: Record<string, { icon: React.ElementType; color: string; badge: string }> = {
    "学校": { icon: School, color: "text-blue-600", badge: "bg-blue-50 text-blue-700 border-blue-200" },
    "二级学院": { icon: Building2, color: "text-violet-600", badge: "bg-violet-50 text-violet-700 border-violet-200" },
    "专业": { icon: BookOpen, color: "text-emerald-600", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    "班级": { icon: Users, color: "text-cyan-600", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    "行政职能部门": { icon: Briefcase, color: "text-rose-600", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  }
  return (
    map[typeName] ?? {
      icon: Building,
      color: "text-slate-600",
      badge: "bg-slate-50 text-slate-700 border-slate-200",
    }
  )
}

function TreeNode({
  node,
  level = 0,
  onToggle,
  onAction,
  highlightedId,
  registerRef,
}: {
  node: OrgNode
  level?: number
  onToggle: (id: string) => void
  onAction: (action: string, node: OrgNode) => void
  highlightedId?: string | null
  registerRef?: (id: string, el: HTMLDivElement | null) => void
}) {
  const hasChildren = node.children && node.children.length > 0
  const meta = typeMetaFor(node.type)
  const Icon = meta.icon
  const isHighlighted = highlightedId === node.id

  return (
    <div ref={(el) => registerRef?.(node.id, el)}>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 hover:bg-muted rounded-lg group transition-colors",
          isHighlighted && "bg-yellow-100 ring-1 ring-yellow-300"
        )}
        style={{ marginLeft: level * 24 }}
      >
        <button
          onClick={() => onToggle(node.id)}
          className="w-5 h-5 flex items-center justify-center"
        >
          {hasChildren ? (
            node.expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        <Icon className={cn("w-4 h-4", meta.color)} />
        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
        <Badge variant="outline" className={cn("text-xs shrink-0", meta.badge)}>
          {node.type}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[3rem] justify-end">
          <Users className="w-3 h-3" />
          {node.memberCount}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction("addChild", node)}>
              添加子节点
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction("edit", node)}>
              编辑
            </DropdownMenuItem>
            {node.type === "班级" && (
              <DropdownMenuItem onClick={() => onAction("graduate", node)}>
                批量毕业
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onAction("delete", node)}
              className="text-destructive"
            >
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && node.expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onToggle={onToggle}
              onAction={onAction}
              highlightedId={highlightedId}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgStructurePage() {
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [orgData, setOrgData] = useState<OrgNode[]>([])
  const [orgTypes, setOrgTypes] = useState<OrgType[]>([])
  const [typeNames, setTypeNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"addRoot" | "addChild" | "edit">("addRoot")
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null)
  const [formName, setFormName] = useState("")
  const [formTypeId, setFormTypeId] = useState("")
  const [formParentId, setFormParentId] = useState<string>("__root__")
  const [formSortOrder, setFormSortOrder] = useState<string>("1")
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrgNode | null>(null)
  const [graduateTarget, setGraduateTarget] = useState<OrgNode | null>(null)
  const [graduateLoading, setGraduateLoading] = useState(false)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const buildTypeNameMap = (types: OrgType[]): Record<string, string> => {
    const map: Record<string, string> = {}
    types.forEach((t) => {
      map[t.id] = t.name
    })
    return map
  }

  const mapToOrgNode = (
    node: Organization & { children?: (Organization & { children?: any[] })[] },
    typeMap: Record<string, string>
  ): OrgNode => {
    const sortedChildren = node.children
      ? [...node.children].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((child) => mapToOrgNode(child, typeMap))
      : undefined
    return {
      id: node.id,
      name: node.name,
      type: typeMap[node.typeId] || "组织",
      typeId: node.typeId,
      parentId: node.parentId,
      order: node.sortOrder,
      memberCount: node.memberCount,
      expanded: true,
      children: sortedChildren,
    }
  }

  const fetchData = async () => {
    if (!tenantId) {
      setIsLoading(false)
      setError("未获取到租户信息，请重新登录")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [treeRes, typesRes] = await Promise.all([
        orgApi.tree({ tenantId }),
        orgTypeApi.list({ tenantId, limit: 1000 }),
      ])
      const map = buildTypeNameMap(typesRes.items)
      setOrgTypes(typesRes.items)
      setTypeNames(map)
      setOrgData(treeRes.items.map((node) => mapToOrgNode(node, map)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载组织架构失败")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  const stats = useMemo(() => {
    const knownTypes = Object.values(typeNames)
    const statMap: Record<string, number> = { members: totalMembers(orgData) }
    knownTypes.forEach((type) => {
      statMap[type] = countByType(orgData, type)
    })
    return statMap
  }, [orgData, typeNames])

  const toggleNode = (id: string) => {
    const toggle = (nodes: OrgNode[]): OrgNode[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, expanded: !node.expanded }
        }
        if (node.children) {
          return { ...node, children: toggle(node.children) }
        }
        return node
      })
    }
    setOrgData(toggle(orgData))
  }

  const registerNodeRef = (id: string, el: HTMLDivElement | null) => {
    nodeRefs.current[id] = el
  }

  useEffect(() => {
    if (!highlightedId) return
    const el = nodeRefs.current[highlightedId]
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      const timer = setTimeout(() => setHighlightedId(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [highlightedId, orgData])

  const openDialog = (mode: typeof dialogMode, node: OrgNode | null = null) => {
    setDialogMode(mode)
    setSelectedNode(node)
    setFormError(null)
    if (mode === "edit" && node) {
      setFormName(node.name)
      setFormTypeId(node.typeId)
      setFormSortOrder(String(node.order))
      setFormParentId(node.parentId ?? "__root__")
    } else if (mode === "addChild" && node) {
      setFormName("")
      setFormTypeId("")
      setFormSortOrder(String(node.children ? node.children.length + 1 : 1))
      setFormParentId(node.id)
    } else {
      setFormName("")
      setFormTypeId("")
      setFormSortOrder(String(orgData.length + 1))
      setFormParentId("__root__")
    }
    setIsDialogOpen(true)
  }

  const handleAction = (action: string, node: OrgNode) => {
    if (action === "addChild") {
      openDialog("addChild", node)
    } else if (action === "edit") {
      openDialog("edit", node)
    } else if (action === "delete") {
      handleDelete(node)
    } else if (action === "graduate") {
      setGraduateTarget(node)
    }
  }

  const parentOptions = useMemo(() => {
    if (!isDialogOpen) return []
    const excluded = new Set<string>()
    if (dialogMode === "edit" && selectedNode) {
      const collect = (node: OrgNode) => {
        excluded.add(node.id)
        node.children?.forEach(collect)
      }
      collect(selectedNode)
    }
    const options: { id: string; name: string; depth: number }[] = []
    const walk = (nodes: OrgNode[], depth: number) => {
      nodes.forEach((n) => {
        if (excluded.has(n.id)) return
        options.push({ id: n.id, name: n.name, depth })
        if (n.children) walk(n.children, depth + 1)
      })
    }
    walk(orgData, 0)
    return options
  }, [isDialogOpen, dialogMode, selectedNode, orgData])

  const handleSave = async () => {
    if (!tenantId) {
      toast({ variant: "destructive", title: "保存失败", description: "未获取到租户信息，请重新登录" })
      return
    }
    if (!formName.trim() || !formTypeId) {
      setFormError("请填写节点名称并选择类型")
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      let targetId: string | null = null
      let toastTitle = ""
      let toastDescription = ""

      if (dialogMode === "edit" && selectedNode) {
        const nextParentId = formParentId === "__root__" ? undefined : formParentId
        const parentChanged = (selectedNode.parentId ?? undefined) !== nextParentId
        await orgApi.update(selectedNode.id, {
          tenantId,
          name: formName.trim(),
          typeId: formTypeId,
          parentId: nextParentId,
          sortOrder: Number(formSortOrder) || 0,
        })
        targetId = selectedNode.id
        toastTitle = "保存成功"
        toastDescription = `组织节点「${formName.trim()}」已更新`
        if (parentChanged) {
          const parentName = nextParentId
            ? parentOptions.find((p) => p.id === nextParentId)?.name
            : null
          toastDescription = parentName
            ? `组织节点「${formName.trim()}」及其子节点已迁移到「${parentName}」下`
            : `组织节点「${formName.trim()}」已调整为一级节点`
        }
      } else {
        const parentId = formParentId === "__root__" ? undefined : formParentId
        const newNode = await orgApi.create({
          tenantId,
          name: formName.trim(),
          typeId: formTypeId,
          parentId,
          sortOrder: Number(formSortOrder) || 0,
          memberCount: 0,
        })
        targetId = newNode.id
        toastTitle = "创建成功"
        toastDescription = `已添加节点「${newNode.name}」`
      }

      await fetchData()
      if (targetId) {
        setHighlightedId(targetId)
      }
      setIsDialogOpen(false)
      toast({ title: toastTitle, description: toastDescription })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (node: OrgNode) => {
    setDeleteTarget(node)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await orgApi.delete(deleteTarget.id)
      toast({ title: "删除成功" })
      await fetchData()
    } catch (err) {
      toast({ variant: "destructive", title: "删除失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setDeleteTarget(null)
    }
  }

  const confirmGraduate = async () => {
    if (!graduateTarget || !tenantId) return
    setGraduateLoading(true)
    try {
      const res = await portalUserManagementApi.list({
        tenantId,
        orgNodeId: graduateTarget.id,
        status: "active",
        limit: 1000,
      })
      const userIds = res.items.map((u) => u.id)
      if (userIds.length === 0) {
        toast({ title: "暂无在籍学生", description: "该班级下没有可毕业的在籍学生" })
        return
      }
      await portalUserManagementApi.batchGraduate({ userIds })
      toast({ title: "批量毕业成功", description: `已将 ${userIds.length} 名学生状态改为毕业` })
    } catch (err) {
      toast({ variant: "destructive", title: "批量毕业失败", description: err instanceof Error ? err.message : "未知错误" })
    } finally {
      setGraduateLoading(false)
      setGraduateTarget(null)
    }
  }

  const statEntries = useMemo(() => {
    return Object.entries(typeNames).map(([, name]) => ({ name, count: stats[name] || 0 }))
  }, [typeNames, stats])

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        加载中...
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#f5f7fa] min-h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">组织架构管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            管理学校组织架构树，同时维护学生线与教师线的组织归属
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Upload className="h-4 w-4 mr-1" />
            批量导入
          </Button>
          <Button variant="outline" size="sm" disabled title="即将上线">
            <Download className="h-4 w-4 mr-1" />
            批量导出
          </Button>
          <Button
            size="sm"
            onClick={() => openDialog("addRoot")}
          >
            <Plus className="h-4 w-4 mr-1" />
            新增节点
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
          <Spinner className="h-5 w-5" />
          加载中...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            {statEntries.slice(0, 5).map((entry) => (
              <div key={entry.name} className="rounded-lg border bg-white p-3 shadow-sm">
                <div className="text-xs text-muted-foreground">{entry.name}</div>
                <div className="mt-1 text-xl font-semibold text-foreground">{entry.count}</div>
              </div>
            ))}
            <div className="rounded-lg border bg-white p-3 shadow-sm">
              <div className="text-xs text-muted-foreground">总人数</div>
              <div className="mt-1 text-xl font-semibold text-foreground">{stats.members}</div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LayoutList className="w-4 h-4 text-muted-foreground" />
                组织架构树
              </div>
            </div>
            <ScrollArea className="h-[600px] p-4">
              {orgData.length === 0 ? (
                <Empty className="h-full">
                  <EmptyHeader>
                    <EmptyTitle>暂无组织架构</EmptyTitle>
                    <EmptyDescription>当前租户下尚未创建组织架构节点</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                orgData.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    onToggle={toggleNode}
                    onAction={handleAction}
                    highlightedId={highlightedId}
                    registerRef={registerNodeRef}
                  />
                ))
              )}
            </ScrollArea>
          </div>
        </>
      )}

      {isDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDialogOpen(false)
          }}
        >
          <div className="bg-background w-full max-w-[500px] rounded-lg border p-6 shadow-lg">
            <div className="flex flex-col gap-2 text-center sm:text-left mb-4">
              <h2 className="text-lg font-semibold">
                {dialogMode === "addRoot"
                  ? "新增节点"
                  : dialogMode === "addChild"
                  ? `添加子节点：${selectedNode?.name}`
                  : "编辑节点"}
              </h2>
              <p className="text-muted-foreground text-sm">配置组织节点信息</p>
            </div>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>节点名称</Label>
                  <Input
                    placeholder="如：信息学院"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>节点类型</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {orgTypes.map((type) => {
                      const meta = typeMetaFor(type.name)
                      const Icon = meta.icon
                      const selected = formTypeId === type.id
                      return (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormTypeId(type.id)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-input hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className={cn("h-5 w-5", meta.color)} />
                          <span className="text-xs font-medium">{type.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>父节点</Label>
                  <Select value={formParentId} onValueChange={setFormParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择父节点" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__root__">无（作为一级节点）</SelectItem>
                      {parentOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {`${"　".repeat(option.depth)}${option.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dialogMode === "edit" && (
                    <p className="text-xs text-muted-foreground">
                      更改父节点后，当前节点及其全部子节点将迁移到新父节点下
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>排序序号</Label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                  />
                </div>
                {formError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>保存失败</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
              </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving || !formName.trim() || !formTypeId}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="确认删除"
        description={`确定删除组织节点「${deleteTarget?.name}」吗？如果该节点下还有子节点或成员，删除可能会失败。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={!!graduateTarget}
        onOpenChange={(open) => !open && !graduateLoading && setGraduateTarget(null)}
        title="确认批量毕业"
        description={`确定将「${graduateTarget?.name}」下的在籍学生全部标记为毕业吗？此操作不可撤销。`}
        confirmText="确认毕业"
        variant="destructive"
        onConfirm={confirmGraduate}
      />
    </div>
  )
}
