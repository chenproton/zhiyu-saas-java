"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { ZoomIn, ZoomOut, Maximize2, Info } from "lucide-react"

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  type: "core" | "related" | "extended"
  description?: string
}

interface GraphEdge {
  from: string
  to: string
  label?: string
}

interface KnowledgeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
}

const TYPE_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  core: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  related: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  extended: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
}

export default function KnowledgeGraph({
  nodes,
  edges,
  width = 800,
  height = 500,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [nodePositions, setNodePositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]))
  )
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    ;(async () => {
      setNodePositions(new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])))
    })()
  }, [nodes])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setScale((s) => Math.min(Math.max(s * delta, 0.3), 3))
  }, [])

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      const pos = nodePositions.get(nodeId)
      if (!pos) return
      dragOffset.current = {
        x: e.clientX - pos.x * scale - translate.x,
        y: e.clientY - pos.y * scale - translate.y,
      }
      setDraggingNode(nodeId)
    },
    [nodePositions, scale, translate]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingNode) return
      const newX = (e.clientX - translate.x - dragOffset.current.x) / scale
      const newY = (e.clientY - translate.y - dragOffset.current.y) / scale
      setNodePositions((prev) => {
        const next = new Map(prev)
        next.set(draggingNode, { x: newX, y: newY })
        return next
      })
    },
    [draggingNode, scale, translate]
  )

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null)
  }, [])

  const resetView = () => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
  }

  const getEdgePath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const midX = (from.x + to.x) / 2
    const midY = (from.y + to.y) / 2 - Math.abs(dx) * 0.1
    return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`
  }

  return (
    <div className="relative rounded-xl border border-gray-100 bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg border border-gray-100 shadow-sm p-1">
        <button
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          onClick={() => setScale((s) => Math.min(s * 1.2, 3))}
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          onClick={() => setScale((s) => Math.max(s * 0.8, 0.3))}
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          onClick={resetView}
          title="重置视图"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/90 backdrop-blur rounded-lg border border-gray-100 shadow-sm p-3">
        <p className="text-xs font-medium text-gray-700 mb-2">图例</p>
        <div className="space-y-1.5">
          {[
            { type: "core", label: "核心知识点" },
            { type: "related", label: "关联知识点" },
            { type: "extended", label: "拓展知识点" },
          ].map(({ type, label }) => (
            <div key={type} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full border"
                style={{
                  backgroundColor: TYPE_COLORS[type].fill,
                  borderColor: TYPE_COLORS[type].stroke,
                }}
              />
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
          </marker>
        </defs>

        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const fromPos = nodePositions.get(edge.from)
            const toPos = nodePositions.get(edge.to)
            if (!fromPos || !toPos) return null
            return (
              <g key={`edge-${i}`}>
                <path
                  d={getEdgePath(fromPos, toPos)}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = nodePositions.get(node.id) ?? { x: node.x, y: node.y }
            const colors = TYPE_COLORS[node.type]
            const isHovered = hoveredNode === node.id
            const radius = node.type === "core" ? 32 : 24

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <circle
                  r={radius + (isHovered ? 4 : 0)}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{ transition: "all 0.15s" }}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={colors.text}
                  fontSize={node.type === "core" ? 13 : 11}
                  fontWeight={node.type === "core" ? 600 : 400}
                >
                  {node.label.length > 4 ? node.label.slice(0, 3) + "…" : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Hover Tooltip */}
      {hoveredNode && (
        <div className="absolute top-3 left-3 z-10 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-[200px]">
          <div className="flex items-center gap-1.5 mb-1">
            <Info className="w-3.5 h-3.5" />
            <span className="font-medium">
              {nodes.find((n) => n.id === hoveredNode)?.label}
            </span>
          </div>
          <p className="text-gray-300 text-[11px]">
            {nodes.find((n) => n.id === hoveredNode)?.description || "关联知识点，点击可查看详情"}
          </p>
        </div>
      )}
    </div>
  )
}
