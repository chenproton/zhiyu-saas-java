"use client"

import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  School,
  Building2,
  BookOpen,
  Users,
  Briefcase,
  Building,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Organization, OrgType } from "@/lib/types/backend"

function typeMetaFor(typeName?: string): { icon: React.ElementType; color: string } {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    "学校": { icon: School, color: "text-blue-600" },
    "二级学院": { icon: Building2, color: "text-violet-600" },
    "专业": { icon: BookOpen, color: "text-emerald-600" },
    "班级": { icon: Users, color: "text-cyan-600" },
    "行政职能部门": { icon: Briefcase, color: "text-rose-600" },
  }
  return (typeName && map[typeName]) || { icon: Building, color: "text-slate-600" }
}

interface OrgFilterTreeProps {
  nodes: Organization[]
  orgTypeMap: Map<string, OrgType>
  selectedId: string | null
  onSelect: (id: string) => void
}

function TreeRow({
  node,
  level,
  orgTypeMap,
  selectedId,
  onSelect,
  collapsedIds,
  onToggle,
}: {
  node: Organization
  level: number
  orgTypeMap: Map<string, OrgType>
  selectedId: string | null
  onSelect: (id: string) => void
  collapsedIds: Set<string>
  onToggle: (id: string) => void
}) {
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const expanded = !collapsedIds.has(node.id)
  const meta = typeMetaFor(orgTypeMap.get(node.typeId)?.name)
  const Icon = meta.icon

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onSelect(node.id)
          }
        }}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 text-sm rounded-md cursor-pointer transition-colors",
          selectedId === node.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
        )}
        style={{ marginLeft: level * 16 }}
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
        <Icon className={cn("w-4 h-4 shrink-0", meta.color)} />
        <span className="truncate">{node.name}</span>
      </div>
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              level={level + 1}
              orgTypeMap={orgTypeMap}
              selectedId={selectedId}
              onSelect={onSelect}
              collapsedIds={collapsedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function OrgFilterTree({ nodes, orgTypeMap, selectedId, onSelect }: OrgFilterTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

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

  return (
    <>
      {nodes.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          level={0}
          orgTypeMap={orgTypeMap}
          selectedId={selectedId}
          onSelect={onSelect}
          collapsedIds={collapsedIds}
          onToggle={toggle}
        />
      ))}
    </>
  )
}

export function collectOrgSubtreeIds(orgMap: Map<string, Organization>, rootId: string): Set<string> {
  const ids = new Set<string>()
  const collect = (node?: Organization) => {
    if (!node || ids.has(node.id)) return
    ids.add(node.id)
    node.children?.forEach((child) => collect(child))
  }
  collect(orgMap.get(rootId))
  return ids
}
