"use client"

import { useState, useMemo, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Plus,
  MoreHorizontal,
  GripVertical,
  BookOpen,
} from "lucide-react"
import type { SystemCourseNode, NodeRefType } from "@/lib/types/lesson-source"
import { NODE_REF_TYPE_LABELS, NODE_REF_TYPE_COLORS } from "@/lib/types/lesson-source"

interface CourseNodeTreeProps {
  nodes: SystemCourseNode[]
  selectedNodeId: string | null
  onSelect: (nodeId: string) => void
  onAddNode: (parentId: string | null, name: string, order: number, type?: NodeRefType, sourceId?: string, sourceName?: string) => void
  onUpdateNode: (nodeId: string, updates: Partial<SystemCourseNode>) => void
  onDeleteNode: (nodeId: string) => void
  onReorderNodes: (nodeId: string, targetNodeId: string) => void
  disableCloneQuote?: boolean
}

interface TreeItem {
  node: SystemCourseNode
  level: number
  children: TreeItem[]
}

function buildTree(nodes: SystemCourseNode[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  const roots: TreeItem[] = []

  const sorted = [...nodes].sort((a, b) => a.order - b.order)

  sorted.forEach((node) => {
    map.set(node.id, { node, level: 0, children: [] })
  })

  sorted.forEach((node) => {
    const item = map.get(node.id)!
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!
      item.level = parent.level + 1
      parent.children.push(item)
    } else {
      roots.push(item)
    }
  })

  return roots
}

export default function CourseNodeTree({
  nodes,
  selectedNodeId,
  onSelect,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onReorderNodes,
}: CourseNodeTreeProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  /* add dialog state */
  const [newNodeName, setNewNodeName] = useState("")
  const [newNodeParent, setNewNodeParent] = useState<string>("root")
  const nextOrderRef = useRef(1)

  const [editNodeName, setEditNodeName] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [deleteNodeId, setDeleteNodeId] = useState<string | null>(null)

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const openAddDialog = useCallback(
    (parentId: string | null = null) => {
      const siblings = nodes.filter((n) => n.parentId === parentId)
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((n) => n.order)) + 1 : 1
      setNewNodeName("")
      setNewNodeParent(parentId ?? "root")
      nextOrderRef.current = nextOrder
      setAddDialogOpen(true)
    },
    [nodes]
  )

  const openEditDialog = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setEditingNodeId(nodeId)
      setEditNodeName(node.name)
      setEditDialogOpen(true)
    },
    [nodes]
  )

  const handleConfirmAdd = () => {
    if (!newNodeName.trim()) return
    const parentId = newNodeParent === "root" ? null : newNodeParent
    onAddNode(parentId, newNodeName.trim(), nextOrderRef.current, "normal")
    setAddDialogOpen(false)
  }

  const handleConfirmEdit = () => {
    if (!editingNodeId || !editNodeName.trim()) return
    onUpdateNode(editingNodeId, { name: editNodeName.trim() })
    setEditDialogOpen(false)
    setEditingNodeId(null)
  }

  const handleDelete = (nodeId: string) => {
    setDeleteNodeId(nodeId)
  }

  const executeDelete = () => {
    if (deleteNodeId) {
      onDeleteNode(deleteNodeId)
      setDeleteNodeId(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, nodeId: string) => {
    setDraggingId(nodeId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault()
    if (draggingId && draggingId !== nodeId) {
      setDragOverId(nodeId)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (draggingId && draggingId !== targetId) {
      onReorderNodes(draggingId, targetId)
    }
    setDraggingId(null)
    setDragOverId(null)
  }

  const renderTreeNode = (item: TreeItem, indexPath: string) => {
    const { node, level, children } = item
    const isActive = selectedNodeId === node.id
    const isDragging = draggingId === node.id
    const isDragOver = dragOverId === node.id
    const seq = indexPath

    return (
      <div key={node.id}>
        <div
          className={cn(
            "tree-node flex items-center gap-1 px-1 py-1 rounded cursor-pointer text-sm transition-colors select-none",
            isActive ? "bg-blue-50 text-blue-600 border-l-2 border-blue-500" : "text-gray-600 hover:bg-gray-50",
            isDragging && "opacity-40",
            isDragOver && "border-t-2 border-blue-500"
          )}
          style={{ paddingLeft: `${8 + level * 10}px` }}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={() => onSelect(node.id)}
        >
          <span className="text-gray-300 cursor-grab opacity-0 hover:opacity-50 transition-opacity">
            <GripVertical className="w-3 h-3" />
          </span>
          <span className="text-gray-400 text-xs w-5 shrink-0">{seq}</span>
          <span className="flex-1 truncate" title={node.name}>
            {node.name}
          </span>
          {node.type && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${NODE_REF_TYPE_COLORS[node.type]}`}>
              {NODE_REF_TYPE_LABELS[node.type]}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-gray-400 hover:text-gray-700 text-xs px-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem onClick={() => openEditDialog(node.id)}>
                ✏ 编辑名称
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openAddDialog(node.id)}>
                + 添加子节点
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-500"
                onClick={() => handleDelete(node.id)}
              >
                🗑 删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {children.length > 0 && (
          <div className="border-l border-gray-100 ml-3">
            {children.map((child, idx) => renderTreeNode(child, `${seq}.${idx + 1}`))}
          </div>
        )}
      </div>
    )
  }

  const isRootAdd = newNodeParent === "root"
  const parentNode = useMemo(
    () => (!isRootAdd ? nodes.find((n) => n.id === newNodeParent) : null),
    [isRootAdd, newNodeParent, nodes]
  )

  return (
    <aside className="w-64 shrink-0">
      <div className="bg-white rounded-xl border border-gray-100 p-3 sticky top-[88px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-500" />
            目录
          </h3>
        </div>
        <div className="space-y-0.5 text-sm">
          {tree.map((item, idx) => renderTreeNode(item, String(idx + 1)))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 text-xs"
          onClick={() => openAddDialog(null)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加节点
        </Button>
        <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
          💡 拖拽节点可调整顺序
        </p>
      </div>

      {/* Add Node Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{isRootAdd ? "添加节点" : "添加子节点"}</DialogTitle>
            {!isRootAdd && parentNode && (
              <p className="text-xs text-gray-500 mt-1">
                将在「<span className="font-medium text-gray-700">{parentNode.name}</span>」下添加子节点
              </p>
            )}
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div>
              <Label className="text-sm">节点名称 <span className="text-red-500">*</span></Label>
              <Input
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="请输入节点名称"
                maxLength={50}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-400 text-right mt-1">
                {newNodeName.length} / 50
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleConfirmAdd} disabled={!newNodeName.trim()}>
              确认添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>编辑节点名称</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>节点名称</Label>
            <Input
              value={editNodeName}
              onChange={(e) => setEditNodeName(e.target.value)}
              placeholder="请输入节点名称"
              maxLength={50}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmEdit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteNodeId !== null}
        onOpenChange={(open) => { if (!open) setDeleteNodeId(null) }}
        title="删除节点"
        description="确定删除该节点吗？删除后其所有子节点也将被删除。"
        variant="destructive"
        onConfirm={executeDelete}
      />
    </aside>
  )
}
