"use client"

import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import {
  Briefcase,
  FileWarning,
  Target,
  BookOpen,
  Lightbulb,
  X,
} from "lucide-react"
import {
  ReactFlow,
  Controls,
  Background,
  MarkerType,
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { GraphNodeDetail, GraphDetailStack } from "./graph-node-detail"
import { cn } from "@/lib/utils"
import type { GraphNode, GraphEdge } from "./types"

type GraphViewProps = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  title?: string
  description?: string
  compact?: boolean
  className?: string
  toolbarSlot?: React.ReactNode
  highlightNodeIds?: Set<string>
  nodeLabels?: Partial<Record<GraphNode["type"], string>>
  role?: string
}

const TYPE_META: Record<
  GraphNode["type"],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  position: {
    label: "岗位",
    color: "#1d4ed8",
    bg: "#dbeafe",
    icon: <Briefcase className="size-5" />,
  },
  domain: {
    label: "能力领域",
    color: "#b91c1c",
    bg: "#fee2e2",
    icon: <FileWarning className="size-5" />,
  },
  unit: {
    label: "能力单元",
    color: "#0e7490",
    bg: "#cffafe",
    icon: <Target className="size-5" />,
  },
  knowledge: {
    label: "知识点",
    color: "#15803d",
    bg: "#dcfce7",
    icon: <Lightbulb className="size-5" />,
  },
  course: {
    label: "教材课件",
    color: "#b45309",
    bg: "#fef3c7",
    icon: <BookOpen className="size-5" />,
  },
}

const TYPE_LEVEL: Record<GraphNode["type"], number> = {
  position: 0,
  domain: 1,
  unit: 2,
  knowledge: 3,
  course: 4,
}

const TYPE_ORDER: GraphNode["type"][] = ["position", "domain", "unit", "knowledge", "course"]

const ROW_GAP = 150
const ITEM_GAP = 150
const START_X = 80
const START_Y = 60

type KGNodeData = {
  type: GraphNode["type"]
  label: string
  dimmed?: boolean
  highlight?: boolean
}

function KnowledgeGraphNode({ data, selected }: NodeProps<Node<KGNodeData, "knowledgeGraph">>) {
  const meta = TYPE_META[data.type]
  const label = data.label || ""

  return (
    <div
      className={cn(
        "flex flex-col items-center transition-opacity",
        data.dimmed && "opacity-20"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full border-2 transition-all",
          selected && "ring-2 ring-offset-2 ring-offset-background",
          data.highlight ? "animate-pulse ring-4 ring-red-400/70 ring-offset-2 ring-offset-background shadow-lg shadow-red-500/40" : ""
        )}
        style={{
          backgroundColor: data.highlight ? "#ef4444" : selected ? meta.color : meta.bg,
          borderColor: data.highlight ? "#b91c1c" : meta.color,
          color: data.highlight ? "#ffffff" : selected ? "#ffffff" : meta.color,
          borderWidth: selected || data.highlight ? 3 : 2,
        }}
      >
        <span className="[&_svg]:size-5">{meta.icon}</span>
      </div>
      <span
        className={cn(
          "mt-1 max-w-[130px] text-center text-[10px] font-medium leading-snug break-words",
          data.highlight ? "font-bold text-red-600" : "text-slate-700",
          data.dimmed && selected && "opacity-100"
        )}
      >
        {label}
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  )
}

const nodeTypes = { knowledgeGraph: KnowledgeGraphNode }

export function KnowledgeGraphView({ nodes, edges, title, description, compact, className, toolbarSlot, highlightNodeIds, nodeLabels }: GraphViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const rfRef = useRef<any>(null)
  const filteredNodes = nodes
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id))
  const filteredEdges = edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))

  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const result = new Set<string>([selectedId])
    filteredEdges.forEach((e) => {
      if (e.source === selectedId) result.add(e.target)
      if (e.target === selectedId) result.add(e.source)
    })
    return result
  }, [selectedId, filteredEdges])

  const layoutedNodes = useMemo(() => {
    const grouped: Record<string, GraphNode[]> = {}
    TYPE_ORDER.forEach((t) => { grouped[t] = [] })
    filteredNodes.forEach((n) => {
      (grouped[n.type] ??= []).push(n)
    })

    const maxCount = Math.max(...TYPE_ORDER.map((t) => grouped[t]?.length || 0))
    const result: Node[] = []

    TYPE_ORDER.forEach((t, rowIdx) => {
      const items = grouped[t]
      if (items.length === 0) return

      // Center the row horizontally based on the widest row
      const rowWidth = items.length * ITEM_GAP
      const maxWidth = maxCount * ITEM_GAP
      const offsetX = (maxWidth - rowWidth) / 2

      items.forEach((n, i) => {
        let dimmed = false
        if (selectedId) {
          dimmed = !connectedIds.has(n.id)
        }
        result.push({
          id: n.id,
          type: "knowledgeGraph",
          position: { x: START_X + offsetX + i * ITEM_GAP, y: START_Y + rowIdx * ROW_GAP },
          data: { label: n.label, type: n.type, dimmed, highlight: highlightNodeIds?.has(n.id) ?? false },
          selected: n.id === selectedId,
        })
      })
    })

    return result
  }, [filteredNodes, selectedId, connectedIds, highlightNodeIds])

  const layoutedEdges = useMemo(() => {
    return filteredEdges.map((e, i) => {
      let dimmed = false
      if (selectedId) {
        dimmed = !connectedIds.has(e.source) || !connectedIds.has(e.target)
      }
      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        sourceHandle: undefined as string | undefined,
        targetHandle: undefined as string | undefined,
        type: "smoothstep" as const,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: dimmed ? "#e2e8f0" : "#94a3b8" },
        style: {
          stroke: dimmed ? "#e2e8f0" : "#94a3b8",
          strokeWidth: dimmed ? 1 : 2,
        },
      }
    })
  }, [filteredEdges, selectedId, connectedIds])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const newId = node.id === selectedId ? null : node.id
    setSelectedId(newId)
  }, [selectedId])

  const onInit = useCallback((instance: any) => {
    rfRef.current = instance
    instance.fitView({ padding: 0.15 })
  }, [])

  useEffect(() => {
    if (!rfRef.current) return
    if (!selectedId) {
      const timer = setTimeout(() => {
        rfRef.current?.fitView({ padding: 0.15, duration: 300 })
      }, 80)
      return () => clearTimeout(timer)
    }
    const connected = new Set<string>([selectedId])
    edges.forEach((e) => {
      if (e.source === selectedId) connected.add(e.target)
      if (e.target === selectedId) connected.add(e.source)
    })
    const fitNodes = layoutedNodes.filter((n) => connected.has(n.id))
    if (fitNodes.length === 0) return
    const timer = setTimeout(() => {
      rfRef.current?.fitView({ nodes: fitNodes, padding: 0.8, duration: 300 })
    }, 80)
    return () => clearTimeout(timer)
  }, [layoutedNodes, selectedId, edges])

  const selectedNode = filteredNodes.find((n) => n.id === selectedId)

  return (
    <div className={cn("flex flex-col gap-5", className || "flex-1 min-h-0")}>
      {toolbarSlot && (
        <div className="flex flex-wrap items-start justify-between gap-3 shrink-0">
          {(title || description) && (
            <div className="flex items-start gap-3">
              <span className="mt-1 h-8 w-1.5 rounded-full bg-gradient-to-b from-[#5b76e8] to-[#8c6ff0]" />
              <div>
                {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {toolbarSlot}
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-4">
        <div className={cn("relative h-full min-h-[200px] rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden", compact ? "lg:col-span-4" : "lg:col-span-3")}>
          <ReactFlow
            nodes={layoutedNodes}
            edges={layoutedEdges}
            onNodeClick={onNodeClick}
            onInit={onInit}
            nodeTypes={nodeTypes}
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background gap={20} size={1} color="#e2e8f0" />
            <Controls showInteractive={false} className="!rounded-lg !shadow !border !bg-background" />
          </ReactFlow>

          <div className="absolute top-3 right-3 bg-white/95 border border-slate-100 rounded-md px-2.5 py-1.5 text-[11px] z-10">
            <div className="font-semibold text-slate-400 mb-1">图例</div>
            {(nodeLabels
              ? (Object.keys(nodeLabels) as GraphNode["type"][])
              : (["position", "domain", "unit", "knowledge", "course"] as const)
            ).map((t) => {
              const meta = TYPE_META[t]
              const label = nodeLabels?.[t] ?? meta.label
              return (
                <div key={t} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-slate-500">{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {!compact && (
          <Card className="lg:col-span-1 flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">节点详情</CardTitle>
              {selectedId && (
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}>
                  <X className="size-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-10 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: TYPE_META[selectedNode.type].color }}
                    >
                      {TYPE_META[selectedNode.type].icon}
                    </div>
                    <div>
                      <div className="font-medium">{selectedNode.label}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {nodeLabels?.[selectedNode.type] ?? TYPE_META[selectedNode.type].label}
                      </Badge>
                    </div>
                  </div>
                  <Separator />
                  <GraphNodeDetail node={selectedNode} />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">点击图谱中的节点查看详情</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <GraphDetailStack
        rootNode={selectedNode ? { id: selectedNode.id, type: selectedNode.type, label: selectedNode.label } : null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
