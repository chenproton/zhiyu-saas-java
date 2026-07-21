"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Network, GitBranch } from "lucide-react"
import type {
  CareerPosition,
  PositionAbilityBinding,
  AbilityPoint,
  AbilityDomain,
} from "@zhiyu/shared-types"
import { GraphDataProvider } from "@/components/knowledge-graph/graph-data-context"
import type { GraphNode, GraphEdge } from "@/components/knowledge-graph/types"

const KnowledgeGraphView = dynamic(
  () => import("@/components/knowledge-graph/knowledge-graph-view").then((mod) => mod.KnowledgeGraphView),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">图谱加载中…</div> }
)

const KnowledgeGraphD3View = dynamic(
  () => import("@/components/knowledge-graph/knowledge-graph-d3-view").then((mod) => mod.KnowledgeGraphD3View),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">图谱加载中…</div> }
)

interface KnowledgeGraphProps {
  position: CareerPosition
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  abilityDomains: AbilityDomain[]
  relatedPositions: CareerPosition[]
}

function ViewToggle({ mode, onChange }: { mode: "static" | "force"; onChange: (m: "static" | "force") => void }) {
  return (
    <div className="flex items-center rounded-lg border bg-muted/60 p-0.5">
      <button
        onClick={() => onChange("static")}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          mode === "static" ? "bg-gradient-to-r from-[#5b76e8] to-[#8c6ff0] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Network className="size-3.5" />静态
      </button>
      <button
        onClick={() => onChange("force")}
        className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
          mode === "force" ? "bg-gradient-to-r from-[#5b76e8] to-[#8c6ff0] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <GitBranch className="size-3.5" />力矩
      </button>
    </div>
  )
}

export function KnowledgeGraph({
  position,
  bindings,
  abilityPoints,
  abilityDomains,
}: KnowledgeGraphProps) {
  const [viewMode, setViewMode] = useState<"static" | "force">("force")

  const abilityPointMap = useMemo(() => {
    const map = new Map<string, AbilityPoint>()
    abilityPoints.forEach((ap) => map.set(ap.id, ap))
    return map
  }, [abilityPoints])

  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    // 岗位
    graphNodes.push({
      id: position.id,
      label: position.shortName || position.name,
      type: "position",
    })

    // 能力领域
    abilityDomains.forEach((domain) => {
      graphNodes.push({ id: domain.id, label: domain.name, type: "domain" })
      graphEdges.push({ source: position.id, target: domain.id })
    })

    // 能力单元：通过 binding 关联到领域
    const unitNodeIds = new Set<string>()
    abilityDomains.forEach((domain) => {
      const domainBindingIds = new Set(domain.bindingIds || [])
      bindings
        .filter((b) => domainBindingIds.has(b.id))
        .forEach((b) => {
          const abilityPoint = abilityPointMap.get(b.abilityPointId)
          if (!abilityPoint) return
          if (!unitNodeIds.has(abilityPoint.id)) {
            unitNodeIds.add(abilityPoint.id)
            graphNodes.push({
              id: abilityPoint.id,
              label: abilityPoint.name,
              type: "unit",
            })
          }
          graphEdges.push({ source: domain.id, target: abilityPoint.id })
        })
    })

    // 知识点与教材课件保留结构，暂不生成节点和边

    return { nodes: graphNodes, edges: graphEdges }
  }, [position, abilityDomains, bindings, abilityPointMap])

  const graphData = useMemo(
    () => ({
      position,
      domains: abilityDomains,
      units: abilityPoints,
      bindings,
    }),
    [position, abilityDomains, abilityPoints, bindings]
  )

  const toolbarSlot = <ViewToggle mode={viewMode} onChange={setViewMode} />

  const sharedProps = {
    nodes,
    edges,
    compact: true,
    className: "flex-1 min-h-0",
    toolbarSlot,
    title: "知识图谱",
    description: "岗位→能力领域→能力单元→知识点→教材课件的完整关联网络（当前仅展示前三级）",
  }

  return (
    <GraphDataProvider value={graphData}>
      <div className="flex flex-col h-[600px]">
        {viewMode === "static" ? (
          <KnowledgeGraphView {...sharedProps} />
        ) : (
          <KnowledgeGraphD3View {...sharedProps} />
        )}
      </div>
    </GraphDataProvider>
  )
}
