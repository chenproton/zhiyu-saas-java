"use client"

import { useEffect, useState } from "react"
import { Briefcase, FileWarning, Target, Lightbulb, BookOpen, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useGraphData } from "./graph-data-context"
import type { GraphNode } from "./types"
import { cn } from "@/lib/utils"
import type { PositionAbilityBinding, AbilityDomain } from "@zhiyu/shared-types"

export type NodeLite = { id: string; type: GraphNode["type"]; label: string }

const COURSE_TYPE_LABEL: Record<string, string> = {
  course: "视频课程",
  material: "课件",
  quiz: "测验",
}

export const GRAPH_TYPE_META: Record<GraphNode["type"], { label: string; color: string; icon: React.ReactNode }> = {
  position: { label: "岗位", color: "#6366f1", icon: <Briefcase className="size-4" /> },
  domain: { label: "能力领域", color: "#f43f5e", icon: <FileWarning className="size-4" /> },
  unit: { label: "能力单元", color: "#10b981", icon: <Target className="size-4" /> },
  knowledge: { label: "知识点", color: "#f59e0b", icon: <Lightbulb className="size-4" /> },
  course: { label: "教材课件", color: "#06b6d4", icon: <BookOpen className="size-4" /> },
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className="flex gap-3 py-2 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 font-medium break-words">{value}</span>
    </div>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-[#5b76e8] to-[#8c6ff0]" />
        {title}
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-muted-foreground">{count} 项</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Chips({
  items,
  empty,
  onNavigate,
}: {
  items: NodeLite[]
  empty: string
  onNavigate?: (node: NodeLite) => void
}) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">{empty}</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const color = GRAPH_TYPE_META[it.type].color
        return (
          <button
            key={`${it.type}-${it.id}`}
            type="button"
            disabled={!onNavigate}
            onClick={() => onNavigate?.(it)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              onNavigate ? "cursor-pointer hover:brightness-95" : "cursor-default"
            )}
            style={{ backgroundColor: `${color}1a`, color }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

function bindingBelongsToDomain(b: PositionAbilityBinding, d: AbilityDomain): boolean {
  if (d.bindingIds && d.bindingIds.length > 0) return d.bindingIds.includes(b.id)
  return (b.domain || "综合能力") === d.name
}

export function GraphNodeDetail({
  node,
  onNavigate,
}: {
  node: Pick<GraphNode, "id" | "type" | "label">
  onNavigate?: (node: NodeLite) => void
}) {
  const { position, domains, units, bindings } = useGraphData()

  if (node.type === "position") {
    const relatedDomainItems: NodeLite[] = (domains ?? []).map((d) => ({ id: d.id, type: "domain", label: d.name }))

    const unitIdSet = new Set<string>()
    const relatedUnitItems: NodeLite[] = []
    bindings?.forEach((b) => {
      if (unitIdSet.has(b.abilityPointId)) return
      unitIdSet.add(b.abilityPointId)
      const abilityPoint = units?.find((u) => u.id === b.abilityPointId)
      relatedUnitItems.push({
        id: b.abilityPointId,
        type: "unit",
        label: abilityPoint?.name || b.domain || "未命名能力",
      })
    })

    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label="岗位名称" value={position?.name} />
        </div>
        <Section title="关联能力领域" count={relatedDomainItems.length}>
          <Chips items={relatedDomainItems} empty="暂无关联能力领域" onNavigate={onNavigate} />
        </Section>
        <Section title="关联能力单元" count={relatedUnitItems.length}>
          <Chips items={relatedUnitItems} empty="暂无关联能力单元" onNavigate={onNavigate} />
        </Section>
      </div>
    )
  }

  if (node.type === "domain") {
    const dom = domains?.find((d) => d.id === node.id)
    const unitIdSet = new Set<string>()
    const relatedUnitItems: NodeLite[] = []
    bindings?.forEach((b) => {
      if (!dom || !bindingBelongsToDomain(b, dom)) return
      if (unitIdSet.has(b.abilityPointId)) return
      unitIdSet.add(b.abilityPointId)
      const abilityPoint = units?.find((u) => u.id === b.abilityPointId)
      relatedUnitItems.push({
        id: b.abilityPointId,
        type: "unit",
        label: abilityPoint?.name || b.domain || "未命名能力",
      })
    })
    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label="领域名称" value={dom?.name} />
          <Field label="所属岗位" value={position?.name} />
          {dom?.description && (
            <Section title="领域说明">
              <p className="text-sm leading-relaxed text-muted-foreground">{dom.description}</p>
            </Section>
          )}
        </div>
        <Section title="关联能力单元" count={relatedUnitItems.length}>
          <Chips items={relatedUnitItems} empty="暂无关联能力单元" onNavigate={onNavigate} />
        </Section>
      </div>
    )
  }

  if (node.type === "unit") {
    const unit = units?.find((u) => u.id === node.id)
    const relatedDomainItems: NodeLite[] = []
    const domainIdSet = new Set<string>()
    domains?.forEach((d) => {
      const belongs = bindings?.some((b) => b.abilityPointId === node.id && bindingBelongsToDomain(b, d))
      if (belongs && !domainIdSet.has(d.id)) {
        domainIdSet.add(d.id)
        relatedDomainItems.push({ id: d.id, type: "domain", label: d.name })
      }
    })
    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label="单元编码" value={unit?.code} />
          <Field label="能力类别" value={unit?.category} />
        </div>
        {unit?.description && (
          <Section title="能力说明">
            <p className="text-sm leading-relaxed text-muted-foreground">{unit.description}</p>
          </Section>
        )}
        <Section title="关联能力领域" count={relatedDomainItems.length}>
          <Chips items={relatedDomainItems} empty="暂无关联能力领域" onNavigate={onNavigate} />
        </Section>
        <Section title="关联知识点" count={0}>
          <span className="text-xs text-muted-foreground">暂无关联知识点</span>
        </Section>
        <Section title="推荐教材课件" count={0}>
          <span className="text-xs text-muted-foreground">暂无关联教材</span>
        </Section>
      </div>
    )
  }

  if (node.type === "knowledge") {
    return (
      <div className="space-y-4">
        <Section title="关联能力单元" count={0}>
          <span className="text-xs text-muted-foreground">暂无关联能力单元</span>
        </Section>
        <Section title="关联教材课件" count={0}>
          <span className="text-xs text-muted-foreground">暂无关联教材课件</span>
        </Section>
      </div>
    )
  }

  if (node.type === "course") {
    return (
      <div className="space-y-4">
        <div className="divide-y">
          <Field label="资源类型" value={COURSE_TYPE_LABEL[node.type]} />
        </div>
        <Section title="关联知识点" count={0}>
          <span className="text-xs text-muted-foreground">暂无关联知识点</span>
        </Section>
      </div>
    )
  }

  return null
}

const MAX_DRAWERS = 3
const DRAWER_W = 380
const DRAWER_GAP = 12

export function GraphDetailStack({
  rootNode,
  onClose,
}: {
  rootNode: NodeLite | null
  onClose: () => void
}) {
  const [stack, setStack] = useState<NodeLite[]>([])

  useEffect(() => {
    if (rootNode) setStack([rootNode])
    else setStack([])
  }, [rootNode])

  if (!rootNode || stack.length === 0) return null

  const navigateFrom = (index: number, n: NodeLite) =>
    setStack((prev) => {
      const next = [...prev.slice(0, index + 1), n]
      return next.length > MAX_DRAWERS ? next.slice(next.length - MAX_DRAWERS) : next
    })
  const closeFrom = (index: number) =>
    setStack((prev) => {
      const next = prev.slice(0, index)
      if (next.length === 0) onClose()
      return next
    })

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {stack.map((node, i) => {
        const depth = stack.length - 1 - i
        const meta = GRAPH_TYPE_META[node.type]
        return (
          <div
            key={`${node.type}-${node.id}-${i}`}
            className="pointer-events-auto absolute inset-y-0 right-0 flex w-[380px] max-w-[92vw] flex-col border-l bg-background shadow-2xl transition-transform duration-300 ease-out"
            style={{
              transform: `translateX(${-depth * (DRAWER_W + DRAWER_GAP)}px)`,
              zIndex: 51 + i,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{node.label}</div>
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {meta.label}
                  </Badge>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeFrom(i)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                title="关闭"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
              <GraphNodeDetail node={node} onNavigate={(n) => navigateFrom(i, n)} />
            </div>
            <div className="border-t px-4 py-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              层级 {i + 1} / {stack.length}
            </div>
          </div>
        )
      })}
    </div>
  )
}
