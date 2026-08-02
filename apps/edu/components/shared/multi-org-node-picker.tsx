'use client'

import { useMemo, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Search, Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrgTree } from '@/hooks/use-org-tree'
import type { Organization, OrgType } from '@/lib/types/backend'
import { typeMetaFor } from '@/lib/org-type-icons'

interface MultiOrgNodePickerProps {
  tenantId?: string
  value: string[]
  onChange: (value: string[]) => void
  selectableTypes?: string[]
  disabled?: boolean
  title?: string
  maxVisible?: number
}

function collectLeafIds(
  node: Organization,
  selectableTypes?: string[],
  typeNameMap?: Map<string, string>,
): string[] {
  const ids: string[] = []
  const collect = (n: any) => {
    const children = (n as any).children as any[] | undefined
    if (!children || children.length === 0) {
      const typeName = typeNameMap?.get(n.typeId) || ''
      if (!selectableTypes || selectableTypes.some((t) => typeName.includes(t))) {
        ids.push(n.id)
      }
    } else {
      children.forEach(collect)
    }
  }
  collect(node)
  return ids
}

interface TreeNodeRowProps {
  node: any
  level: number
  orgTypeMap: Map<string, OrgType>
  typeNameMap: Map<string, string>
  selectableTypes?: string[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onBatchSelect: (ids: string[]) => void
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  visibleIds: Set<string>
  searching: boolean
}

function TreeNodeRow({
  node,
  level,
  orgTypeMap,
  typeNameMap,
  selectableTypes,
  selectedIds,
  onToggleSelect,
  onBatchSelect,
  collapsedIds,
  onToggle,
  visibleIds,
  searching,
}: TreeNodeRowProps) {
  const children = (node.children ?? []) as any[]
  const hasChildren = children.length > 0
  const expanded = !collapsedIds.has(node.id)
  const meta = typeMetaFor(orgTypeMap.get(node.typeId)?.name)
  const Icon = meta.icon
  const nodeTypeName = typeNameMap.get(node.typeId) || ''
  const isSelectable = !selectableTypes || selectableTypes.some((t) => nodeTypeName.includes(t))
  const allChildIds = useMemo(
    () => (hasChildren ? collectLeafIds(node, selectableTypes, typeNameMap) : []),
    [node, selectableTypes, typeNameMap, hasChildren],
  )
  const allSelected = allChildIds.length > 0 && allChildIds.every((id) => selectedIds.has(id))
  const someSelected = allChildIds.some((id) => selectedIds.has(id))

  if (!visibleIds.has(node.id)) return null

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 py-1 px-2 text-sm rounded-md transition-colors',
          level === 0 && isSelectable && 'hover:bg-muted',
        )}
        style={{ marginLeft: searching ? 0 : level * 16 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
          className="w-4 h-4 flex items-center justify-center shrink-0"
          tabIndex={-1}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )
          ) : (
            <span className="w-3.5" />
          )}
        </button>
        {isSelectable ? (
          <Checkbox
            checked={selectedIds.has(node.id)}
            onCheckedChange={() => onToggleSelect(node.id)}
            className="shrink-0"
          />
        ) : hasChildren ? (
          <input
            type="checkbox"
            className="shrink-0 w-4 h-4 rounded border-gray-300 accent-blue-600"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected
            }}
            onChange={() =>
              onBatchSelect(
                allChildIds.filter((id) =>
                  allSelected ? selectedIds.has(id) : !selectedIds.has(id),
                ),
              )
            }
          />
        ) : null}
        <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren &&
        expanded &&
        children.map((child: any) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            level={searching ? 0 : level + 1}
            orgTypeMap={orgTypeMap}
            typeNameMap={typeNameMap}
            selectableTypes={selectableTypes}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onBatchSelect={onBatchSelect}
            collapsedIds={collapsedIds}
            onToggle={onToggle}
            visibleIds={visibleIds}
            searching={searching}
          />
        ))}
    </div>
  )
}

export function MultiOrgNodePicker({
  tenantId,
  value,
  onChange,
  selectableTypes,
  disabled,
  title = '选择班级',
  maxVisible = 5,
}: MultiOrgNodePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const { orgs, orgTypeMap, typeNameMap, loading: orgLoading } = useOrgTree(tenantId)
  const [pendingIds, setPendingIds] = useState<string[]>([])

  const getNodeName = useCallback(
    (id: string) => {
      const find = (nodes: any[]): string | null => {
        for (const n of nodes) {
          if (n.id === id) return n.name
          if (n.children) {
            const r = find(n.children)
            if (r) return r
          }
        }
        return null
      }
      return find(orgs) || id
    },
    [orgs],
  )

  const visibleIds = useMemo(() => {
    if (!search) {
      const ids = new Set<string>()
      const add = (nodes: any[]) => {
        nodes.forEach((n: any) => {
          ids.add(n.id)
          if (n.children) add(n.children)
        })
      }
      add(orgs)
      return ids
    }
    const ids = new Set<string>()
    const lower = search.toLowerCase()
    const addWithParents = (nodes: any[], parentIds: string[]): boolean => {
      let found = false
      for (const n of nodes) {
        const path = [...parentIds, n.id]
        const match = n.name.toLowerCase().includes(lower)
        const childMatch = n.children ? addWithParents(n.children, path) : false
        if (match || childMatch) {
          found = true
          path.forEach((id) => ids.add(id))
        }
      }
      return found
    }
    addWithParents(orgs, [])
    return ids
  }, [orgs, search])

  const selectedSet = useMemo(
    () => new Set(pendingIds.length > 0 ? pendingIds : value),
    [pendingIds, value],
  )

  const handleToggle = (id: string) => {
    setCollapsedIds((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleToggleSelect = (id: string) => {
    setPendingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleBatchSelect = (ids: string[]) => {
    setPendingIds((prev) => {
      const add = ids.filter((id) => !prev.includes(id))
      const remove = new Set(ids.filter((id) => prev.includes(id)))
      return [...prev.filter((id) => !remove.has(id)), ...add]
    })
  }

  const handleConfirm = () => {
    onChange(pendingIds)
    setPendingIds([])
    setOpen(false)
  }

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setSearch('')
      setCollapsedIds(new Set())
      setPendingIds([...value])
    }
    setOpen(v)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {value.slice(0, maxVisible).map((id) => (
          <Badge key={id} variant="secondary" className="gap-1 pr-1">
            <span className="max-w-[100px] truncate">{getNodeName(id)}</span>
            <button
              className="ml-0.5 hover:text-destructive"
              onClick={() => onChange(value.filter((x) => x !== id))}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {value.length > maxVisible && (
          <Badge variant="outline" className="gap-1 text-xs">
            +{value.length - maxVisible}
          </Badge>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 px-2 text-xs"
          onClick={() => handleOpenChange(true)}
        >
          <Plus className="mr-1 h-3 w-3" />
          {value.length > 0 ? '管理班级' : '添加班级'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-[360px] border rounded-md p-2">
            {orgLoading || !tenantId ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : orgs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无组织架构数据
              </div>
            ) : (
              orgs.map((node) => (
                <TreeNodeRow
                  key={node.id}
                  node={node}
                  level={0}
                  orgTypeMap={orgTypeMap}
                  typeNameMap={typeNameMap}
                  selectableTypes={selectableTypes}
                  selectedIds={selectedSet}
                  onToggleSelect={handleToggleSelect}
                  onBatchSelect={handleBatchSelect}
                  collapsedIds={collapsedIds}
                  onToggle={handleToggle}
                  visibleIds={visibleIds}
                  searching={!!search}
                />
              ))
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleConfirm}>确认 ({pendingIds.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
