"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Network, GitBranch } from "lucide-react"
import type { Scenario, ScenarioTask, KnowledgePoint } from "@/lib/types"
import type { GraphNode, GraphEdge } from "@/components/knowledge-graph/types"
import { ChunkErrorBoundary } from "@/components/chunk-error-handler"

const KnowledgeGraphView = dynamic(
  () => import("@/components/knowledge-graph/knowledge-graph-view").then((mod) => mod.KnowledgeGraphView),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">图谱加载中…</div> }
)

const KnowledgeGraphD3View = dynamic(
  () => import("@/components/knowledge-graph/knowledge-graph-d3-view").then((mod) => mod.KnowledgeGraphD3View),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">图谱加载中…</div> }
)

const NODE_LABELS = {
  position: "场景",
  domain: "任务",
  unit: "能力点",
  knowledge: "知识点",
} as const

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

interface SceneKnowledgeGraphProps {
  scenario: Scenario
  tasks: ScenarioTask[]
  knowledgeMap: Map<string, KnowledgePoint>
}

export function SceneKnowledgeGraph({ scenario, tasks, knowledgeMap }: SceneKnowledgeGraphProps) {
  const [viewMode, setViewMode] = useState<"static" | "force">("force")

  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    const allKnowledgeIds = new Set<string>()
    tasks.forEach((t) => {
      t.knowledgePointIds?.forEach((kid) => allKnowledgeIds.add(kid))
    })

    if (tasks.length === 0 && allKnowledgeIds.size === 0) {
      return { nodes: graphNodes, edges: graphEdges }
    }

    graphNodes.push({
      id: scenario.id,
      label: scenario.name || "场景",
      type: "position",
    })

    tasks.forEach((task) => {
      graphNodes.push({
        id: task.id,
        label: task.name || task.code || "任务",
        type: "domain",
      })
      graphEdges.push({ source: scenario.id, target: task.id })

      task.knowledgePointIds?.forEach((kid) => {
        const kp = knowledgeMap.get(kid)
        if (!kp) return
        graphNodes.push({
          id: kp.id,
          label: kp.name || kp.code || "知识点",
          type: "knowledge",
        })
        graphEdges.push({ source: task.id, target: kp.id })
      })
    })

    return { nodes: graphNodes, edges: graphEdges }
  }, [scenario, tasks, knowledgeMap])

  if (nodes.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        暂无图谱数据
      </div>
    )
  }

  const toolbarSlot = <ViewToggle mode={viewMode} onChange={setViewMode} />

  const sharedProps = {
    nodes,
    edges,
    compact: true,
    className: "flex-1 min-h-0",
    toolbarSlot,
    title: "知识图谱",
    description: "场景 → 任务 → 知识点的关联网络",
    nodeLabels: NODE_LABELS,
  }

  return (
    <div className="flex flex-col h-[600px]">
      {viewMode === "static" ? (
        <ChunkErrorBoundary Component={KnowledgeGraphView} componentProps={sharedProps} />
      ) : (
        <ChunkErrorBoundary Component={KnowledgeGraphD3View} componentProps={sharedProps} />
      )}
    </div>
  )
}
