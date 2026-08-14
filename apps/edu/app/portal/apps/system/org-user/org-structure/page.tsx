'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  Users,
  Download,
  GraduationCap,
  LayoutList,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchAllPages } from '@zhiyu/api-client'
import { HoverActionBar } from '@/components/shared/hover-action-bar'
import {
  orgApi,
  orgTypeApi,
  portalUserManagementApi,
  importExportApi,
  downloadBlob,
} from '@/lib/api'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PortalCrudPage } from '@/components/shared/portal-crud-page'
import type { Organization, OrgType } from '@/lib/types/backend'
import { usePortalAuth } from '@/contexts/portal-auth-context'
import { useToast } from '@zhiyu/ui'
import { typeMetaFor } from '@/lib/org-type-icons'
import { useT } from '@/lib/i18n/locale-provider'

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

function mapToOrgNode(
  node: Organization & { children?: (Organization & { children?: any[] })[] },
  typeMap: Record<string, string>,
): OrgNode {
  const sortedChildren = node.children
    ? [...node.children]
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((child) => mapToOrgNode(child, typeMap))
    : undefined
  return {
    id: node.id,
    name: node.name,
    type: typeMap[node.typeId] || '组织',
    typeId: node.typeId,
    parentId: node.parentId,
    order: node.sortOrder,
    memberCount: node.memberCount,
    expanded: true,
    children: sortedChildren,
  }
}

function totalMembers(nodes: OrgNode[]): number {
  // 递归累加子节点，与 countByType 口径一致（memberCount 为节点自身人数时）
  return nodes.reduce(
    (sum, node) => sum + node.memberCount + (node.children ? totalMembers(node.children) : 0),
    0,
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
  const t = useT()
  const hasChildren = node.children && node.children.length > 0
  const meta = typeMetaFor(node.type)
  const Icon = meta.icon
  const isHighlighted = highlightedId === node.id

  return (
    <div ref={(el) => registerRef?.(node.id, el)}>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 hover:bg-muted rounded-lg group transition-colors relative',
          isHighlighted && 'bg-yellow-100 ring-1 ring-yellow-300',
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
        <Icon className={cn('w-4 h-4', meta.color)} />
        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
        <Badge variant="outline" className={cn('text-xs shrink-0', meta.badge)}>
          {node.type}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[3rem] justify-end">
          <Users className="w-3 h-3" />
          {node.memberCount}
        </div>
        <HoverActionBar>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onAction('addChild', node)}
          >
            <Plus className="mr-1 h-3 w-3" />
            {t('添加子节点')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onAction('edit', node)}
          >
            <Pencil className="mr-1 h-3 w-3" />
            {t('编辑')}
          </Button>
          {node.type === '班级' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onAction('graduate', node)}
            >
              <GraduationCap className="mr-1 h-3 w-3" />
              {t('批量毕业')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
            onClick={() => onAction('delete', node)}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {t('删除')}
          </Button>
        </HoverActionBar>
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
  const t = useT()
  const { tenantId } = usePortalAuth()
  const { toast } = useToast()
  const [orgData, setOrgData] = useState<OrgNode[]>([])
  const [orgTypes, setOrgTypes] = useState<OrgType[]>([])
  const [typeNames, setTypeNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'addRoot' | 'addChild' | 'edit'>('addRoot')
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null)
  const [formName, setFormName] = useState('')
  const [formTypeId, setFormTypeId] = useState('')
  const [formParentId, setFormParentId] = useState<string>('__root__')
  const [formSortOrder, setFormSortOrder] = useState<string>('1')
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrgNode | null>(null)
  const [graduateTarget, setGraduateTarget] = useState<OrgNode | null>(null)
  const [graduateLoading, setGraduateLoading] = useState(false)
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    ;(async () => {
      setMounted(true)
    })()
  }, [])

  const buildTypeNameMap = (types: OrgType[]): Record<string, string> => {
    const map: Record<string, string> = {}
    types.forEach((t) => {
      map[t.id] = t.name
    })
    return map
  }

  const fetchData = useCallback(async () => {
    if (!tenantId) {
      setIsLoading(false)
      setError(t('未获取到租户信息，请重新登录'))
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
      setError(err instanceof Error ? err.message : t('加载组织架构失败'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId, t])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!cancelled) await fetchData()
    })()
    return () => {
      cancelled = true
    }
  }, [fetchData])

  const stats = useMemo(() => {
    const knownTypes = Object.values(typeNames)
    const statMap: Record<string, number> = { members: totalMembers(orgData) }
    knownTypes.forEach((type) => {
      statMap[type] = countByType(orgData, type)
    })
    return statMap
  }, [orgData, typeNames])

  const statEntries = useMemo(() => {
    return Object.entries(typeNames).map(([, name]) => ({ name, count: stats[name] || 0 }))
  }, [typeNames, stats])

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
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const timer = setTimeout(() => setHighlightedId(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [highlightedId, orgData])

  const openDialog = (mode: typeof dialogMode, node: OrgNode | null = null) => {
    setDialogMode(mode)
    setSelectedNode(node)
    setFormError(null)
    if (mode === 'edit' && node) {
      setFormName(node.name)
      setFormTypeId(node.typeId)
      setFormSortOrder(String(node.order))
      setFormParentId(node.parentId ?? '__root__')
    } else if (mode === 'addChild' && node) {
      setFormName('')
      setFormTypeId('')
      setFormSortOrder(String(node.children ? node.children.length + 1 : 1))
      setFormParentId(node.id)
    } else {
      setFormName('')
      setFormTypeId('')
      setFormSortOrder(String(orgData.length + 1))
      setFormParentId('__root__')
    }
    setIsDialogOpen(true)
  }

  const handleAction = (action: string, node: OrgNode) => {
    if (action === 'addChild') {
      openDialog('addChild', node)
    } else if (action === 'edit') {
      openDialog('edit', node)
    } else if (action === 'delete') {
      handleDelete(node)
    } else if (action === 'graduate') {
      setGraduateTarget(node)
    }
  }

  const parentOptions = useMemo(() => {
    if (!isDialogOpen) return []
    const excluded = new Set<string>()
    if (dialogMode === 'edit' && selectedNode) {
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
      toast({
        variant: 'destructive',
        title: t('保存失败'),
        description: t('未获取到租户信息，请重新登录'),
      })
      return
    }
    if (!formName.trim() || !formTypeId) {
      setFormError(t('请填写节点组织名称并选择组织类型'))
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      let targetId: string | null = null
      let toastTitle = ''
      let toastDescription = ''

      if (dialogMode === 'edit' && selectedNode) {
        const nextParentId = formParentId === '__root__' ? undefined : formParentId
        const parentChanged = (selectedNode.parentId ?? undefined) !== nextParentId
        await orgApi.update(selectedNode.id, {
          tenantId,
          name: formName.trim(),
          typeId: formTypeId,
          parentId: nextParentId,
          sortOrder: Number(formSortOrder) || 0,
        })
        targetId = selectedNode.id
        toastTitle = t('保存成功')
        toastDescription = t('组织节点「{name}」已更新', { name: formName.trim() })
        if (parentChanged) {
          const parentName = nextParentId
            ? parentOptions.find((p) => p.id === nextParentId)?.name
            : null
          toastDescription = parentName
            ? t('组织节点「{name}」及其子节点已迁移到「{parent}」下', {
                name: formName.trim(),
                parent: parentName,
              })
            : t('组织节点「{name}」已调整为一级节点', { name: formName.trim() })
        }
      } else {
        const parentId = formParentId === '__root__' ? undefined : formParentId
        const newNode = await orgApi.create({
          tenantId,
          name: formName.trim(),
          typeId: formTypeId,
          parentId,
          sortOrder: Number(formSortOrder) || 0,
          memberCount: 0,
        })
        targetId = newNode.id
        toastTitle = t('创建成功')
        toastDescription = t('已添加节点「{name}」', { name: newNode.name })
      }

      await fetchData()
      if (targetId) {
        setHighlightedId(targetId)
      }
      setIsDialogOpen(false)
      toast({ title: toastTitle, description: toastDescription })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('保存失败，请重试'))
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
      toast({ title: t('删除成功') })
      await fetchData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('删除失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  const confirmGraduate = async () => {
    if (!graduateTarget || !tenantId) return
    setGraduateLoading(true)
    try {
      const items = await fetchAllPages((page, pageSize) =>
        portalUserManagementApi.list({
          tenantId,
          orgNodeId: graduateTarget.id,
          status: 'active',
          limit: pageSize,
          offset: page * pageSize,
        }),
      )
      const userIds = items.map((u) => u.id)
      if (userIds.length === 0) {
        toast({ title: t('暂无在籍学生'), description: t('该班级下没有可毕业的在籍学生') })
        return
      }
      await portalUserManagementApi.batchGraduate({ userIds })
      toast({
        title: t('批量毕业成功'),
        description: t('已将 {n} 名学生状态改为毕业', { n: userIds.length }),
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('批量毕业失败'),
        description: err instanceof Error ? err.message : t('未知错误'),
      })
    } finally {
      setGraduateLoading(false)
      setGraduateTarget(null)
    }
  }

  const handleExport = async () => {
    try {
      const res = await importExportApi.exportOrganizationsExcel([])
      downloadBlob(await res.blob(), t('组织架构导出.xlsx'))
      toast({ title: t('导出完成') })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: t('导出失败'),
        description: err.message || t('导出失败'),
      })
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        {t('加载中...')}
      </div>
    )
  }

  return (
    <PortalCrudPage
      title={t('组织架构管理')}
      description={t('管理学校组织架构树，同时维护学生线与教师线的组织归属')}
      entityLabel={t('组织节点')}
      items={orgData}
      loading={isLoading}
      error={error}
      onRetry={fetchData}
      colSpan={1}
      search={false}
      stats={[
        ...statEntries.slice(0, 5).map((entry) => ({ label: entry.name, value: entry.count })),
        { label: t('总人数'), value: stats.members },
      ]}
      importConfig={{
        importType: 'organizations',
        entityLabel: t('组织'),
        templateFileName: t('组织批量导入模板.xlsx'),
      }}
      hideCreate
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            {t('批量导出')}
          </Button>
        </>
      }
      afterImportActions={
        <Button size="sm" onClick={() => openDialog('addRoot')}>
          <Plus className="h-4 w-4 mr-1" />
          {t('新建节点')}
        </Button>
      }
      body={
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm font-medium">
              <LayoutList className="w-4 h-4 text-muted-foreground" />
              {t('组织架构树')}
            </div>
          </div>
          <ScrollArea className="h-[600px] p-4">
            {orgData.length === 0 ? (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyTitle>{t('暂无组织架构')}</EmptyTitle>
                  <EmptyDescription>{t('当前租户下尚未创建组织架构节点')}</EmptyDescription>
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
      }
    >
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'addRoot'
                ? t('新增节点')
                : dialogMode === 'addChild'
                  ? t('添加子节点：{name}', { name: selectedNode?.name ?? '' })
                  : t('编辑节点')}
            </DialogTitle>
            <DialogDescription>{t('配置组织节点信息')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{t('节点组织名称')}</Label>
              <Input
                placeholder={t('如：信息学院')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('组织类型')}</Label>
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
                        'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-input hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Icon className={cn('h-5 w-5', meta.color)} />
                      <span className="text-xs font-medium">{type.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {t('父节点')}
                {dialogMode === 'edit' && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {t('更改父节点后，当前节点及其全部子节点将迁移到新父节点下')}
                  </span>
                )}
              </Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('选择父节点')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">{t('无（作为一级节点）')}</SelectItem>
                  {parentOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {`${'　'.repeat(option.depth)}${option.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('排序序号')}</Label>
              <Input
                type="number"
                placeholder="1"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
              />
            </div>
            {formError && (
              <div className="rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
              {t('取消')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim() || !formTypeId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('确认删除')}
        description={t('确定删除组织节点「{name}」吗？其子节点会被一并删除，节点下的用户将保留但清空所属班级/部门。', {
          name: deleteTarget?.name ?? '',
        })}
        confirmText={t('删除')}
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={!!graduateTarget}
        onOpenChange={(open) => !open && !graduateLoading && setGraduateTarget(null)}
        title={t('确认批量毕业')}
        description={t('确定将「{name}」下的在籍学生全部标记为毕业吗？此操作不可撤销。', {
          name: graduateTarget?.name ?? '',
        })}
        confirmText={t('确认毕业')}
        variant="destructive"
        onConfirm={confirmGraduate}
      />
    </PortalCrudPage>
  )
}
