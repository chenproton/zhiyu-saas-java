'use client'

import { useMemo, useState } from 'react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronRight, ChevronsUpDown, Search, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrgTree } from '@/hooks/use-org-tree'
import type { Organization, OrgType } from '@/lib/types/backend'
import { typeMetaFor } from '@/lib/org-type-icons'

interface OrgNodePickerProps {
  tenantId?: string
  value?: string
  onChange: (value: string | undefined) => void
  selectableTypes?: string[]
  placeholder?: string
  disabled?: boolean
  title?: string
}

function PickerTreeRow({
  node,
  level,
  orgTypeMap,
  selectableTypes,
  pendingId,
  onPick,
  collapsedIds,
  onToggle,
  visibleIds,
  searching,
}: {
  node: Organization
  level: number
  orgTypeMap: Map<string, OrgType>
  selectableTypes?: string[]
  pendingId: string | null
  onPick: (id: string) => void
  collapsedIds: Set<string>
  onToggle: (id: string) => void
  visibleIds: Set<string> | null
  searching: boolean
}) {
  if (visibleIds && !visibleIds.has(node.id)) return null

  const children = node.children ?? []
  const hasChildren = children.length > 0
  const expanded = searching || !collapsedIds.has(node.id)
  const typeName = orgTypeMap.get(node.typeId)?.name
  const meta = typeMetaFor(typeName)
  const Icon = meta.icon
  const selectable = !selectableTypes || (!!typeName && selectableTypes.includes(typeName))

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (selectable) {
            onPick(node.id)
          } else if (hasChildren) {
            onToggle(node.id)
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && selectable) {
            e.preventDefault()
            onPick(node.id)
          }
        }}
        className={cn(
          'flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md transition-colors',
          selectable ? 'cursor-pointer' : 'cursor-default',
          pendingId === node.id
            ? 'bg-primary/10 text-primary font-medium'
            : selectable
              ? 'hover:bg-muted'
              : 'hover:bg-muted/50',
        )}
        style={{ marginLeft: level * 20 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren && !searching) onToggle(node.id)
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
        <Icon className={cn('w-4 h-4 shrink-0', meta.color)} />
        <span className={cn('truncate', !selectable && 'text-muted-foreground')}>{node.name}</span>
        {typeName && (
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{typeName}</span>
        )}
      </div>
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <PickerTreeRow
              key={child.id}
              node={child}
              level={level + 1}
              orgTypeMap={orgTypeMap}
              selectableTypes={selectableTypes}
              pendingId={pendingId}
              onPick={onPick}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
              visibleIds={visibleIds}
              searching={searching}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgNodePicker({
  tenantId,
  value,
  onChange,
  selectableTypes,
  placeholder = '选择组织节点',
  disabled,
  title = '选择组织节点',
}: OrgNodePickerProps) {
  const { orgs, orgMap, orgTypeMap, loading } = useOrgTree(tenantId)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  const selectedNode = value ? orgMap.get(value) : undefined

  const visibleIds = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return null
    const visible = new Set<string>()
    const walk = (node: Organization): boolean => {
      const selfMatch = node.name.toLowerCase().includes(term)
      let childMatch = false
      node.children?.forEach((child) => {
        if (walk(child)) childMatch = true
      })
      if (selfMatch || childMatch) {
        visible.add(node.id)
        return true
      }
      return false
    }
    orgs.forEach((node) => walk(node))
    return visible
  }, [search, orgs])

  const searching = search.trim() !== ''

  const toggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openDialog = () => {
    setPendingId(value || null)
    setSearch('')
    setCollapsedIds(new Set())
    setOpen(true)
  }

  const confirm = () => {
    onChange(pendingId || undefined)
    setOpen(false)
  }

  const pendingNode = pendingId ? orgMap.get(pendingId) : undefined

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !tenantId}
        onClick={openDialog}
        className="w-full justify-between font-normal"
      >
        <span className={cn('truncate', !selectedNode && 'text-muted-foreground')}>
          {selectedNode ? selectedNode.name : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {selectableTypes && selectableTypes.length > 0
                ? `在组织架构树中选择${selectableTypes.join('/')}类型节点，支持按名称搜索`
                : '在组织架构树中选择节点，支持按名称搜索'}
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索节点名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ScrollArea className="h-[400px] rounded-md border p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载中...
              </div>
            ) : orgs.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无组织架构数据
              </div>
            ) : visibleIds && visibleIds.size === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                未找到匹配的节点
              </div>
            ) : (
              orgs.map((node) => (
                <PickerTreeRow
                  key={node.id}
                  node={node}
                  level={0}
                  orgTypeMap={orgTypeMap}
                  selectableTypes={selectableTypes}
                  pendingId={pendingId}
                  onPick={setPendingId}
                  collapsedIds={collapsedIds}
                  onToggle={toggle}
                  visibleIds={visibleIds}
                  searching={searching}
                />
              ))
            )}
          </ScrollArea>
          <DialogFooter className="items-center gap-2 sm:justify-between">
            <div className="text-sm text-muted-foreground truncate">
              {pendingNode ? `已选择：${pendingNode.name}` : '未选择节点'}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={confirm} disabled={!pendingId}>
                确定
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
