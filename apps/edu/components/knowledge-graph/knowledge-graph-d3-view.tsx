"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Briefcase, FileWarning, Target, BookOpen, Lightbulb,
  ZoomIn, ZoomOut, RotateCcw, X,
} from "lucide-react"
import * as d3 from "d3"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { GraphNodeDetail, GraphDetailStack } from "./graph-node-detail"
import { cn } from "@/lib/utils"
import type { GraphNode, GraphEdge } from "./types"

const SIMULATION_ALPHA = 0.3
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

type SimNode = GraphNode & { x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null }
type SimLink = { source: SimNode; target: SimNode }

const TYPE_META_D3: Record<GraphNode["type"], {
  label: string; color: string; bg: string; radius: number; fontSize: number; icon: React.ReactNode
}> = {
  position:  { label: "岗位", color: "#6366f1", bg: "#eef2ff", radius: 32, fontSize: 14, icon: <Briefcase className="size-4" /> },
  domain:    { label: "能力领域", color: "#f43f5e", bg: "#fff1f2", radius: 20, fontSize: 11, icon: <FileWarning className="size-4" /> },
  unit:      { label: "能力单元", color: "#10b981", bg: "#ecfdf5", radius: 20, fontSize: 11, icon: <Target className="size-4" /> },
  knowledge: { label: "知识点", color: "#f59e0b", bg: "#fffbeb", radius: 12, fontSize: 10, icon: <Lightbulb className="size-4" /> },
  course:    { label: "教材课件", color: "#06b6d4", bg: "#ecfeff", radius: 12, fontSize: 10, icon: <BookOpen className="size-4" /> },
}

const TYPE_LEVEL_D3: Record<GraphNode["type"], number> = {
  position: 0, domain: 1, unit: 2, knowledge: 3, course: 4,
}

function getD3IconSvg(type: GraphNode["type"]): SVGSVGElement | null {
  const parser = new DOMParser()
  const svgs: Record<string, string> = {
    position: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>',
    domain: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
    unit: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>',
    knowledge: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2.5 1.5-4 0-3.5-3-6.5-7-6.5S4 4 4 7.5c0 1.5.5 3 1.5 4 .8.8 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>',
    course: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
  }
  const s = svgs[type]; if (!s) return null
  return parser.parseFromString(s, "image/svg+xml").querySelector("svg")
}

export function KnowledgeGraphD3View({ nodes, edges, title, description, compact, className, toolbarSlot, highlightNodeIds, nodeLabels }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simNodesRef = useRef<SimNode[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const updateSize = () => {
      const rect = containerRef.current!.getBoundingClientRect()
      setDims({ width: Math.max(rect.width, 400), height: Math.max(rect.height, 500) })
    }
    updateSize()
    const ro = new ResizeObserver(updateSize)
    ro.observe(containerRef.current)
    window.addEventListener("resize", updateSize)
    return () => { ro.disconnect(); window.removeEventListener("resize", updateSize) }
  }, [])

  const filteredNodes = useMemo(() => nodes, [nodes])
  const filteredEdges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id))
    return edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [nodes, edges])

  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const result = new Set<string>([selectedId])
    filteredEdges.forEach((e) => {
      if (e.source === selectedId) result.add(e.target)
      if (e.target === selectedId) result.add(e.source)
    })
    return result
  }, [selectedId, filteredEdges])

  useEffect(() => {
    if (!svgRef.current || !gRef.current || filteredNodes.length === 0) return

    const svg = d3.select(svgRef.current)
    const g = d3.select(gRef.current)
    g.selectAll("*").remove()

    const W = dims.width, H = dims.height

    const simNodes: SimNode[] = filteredNodes.map((n) => ({ ...n, x: W / 2 + (Math.random() - 0.5) * 200, y: H / 2 + (Math.random() - 0.5) * 200 }))
    simNodesRef.current = simNodes
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]))
    const simLinks: SimLink[] = filteredEdges
      .map((e) => { const s = nodeMap.get(e.source); const t = nodeMap.get(e.target); return s && t ? { source: s, target: t } : null })
      .filter(Boolean) as SimLink[]

    const linkG = g.append("g").selectAll("path").data(simLinks).join("path")
      .attr("class", "link-d3")
      .attr("fill", "none").attr("stroke", "#c8d8f0").attr("stroke-width", 1).attr("opacity", 0.6)

    const nodeG = g.append("g").selectAll("g").data(simNodes).join("g")
      .attr("class", "node-d3")
      .style("cursor", "pointer")

    const simulation = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id)
        .distance((d: any) => {
          const sl = TYPE_LEVEL_D3[(d.source as SimNode).type], tl = TYPE_LEVEL_D3[(d.target as SimNode).type]
          return Math.abs(tl - sl) <= 1 ? 100 : 140
        }))
      .force("charge", d3.forceManyBody().strength((d: any) => {
        const t = (d as SimNode).type
        if (t === "position") return -2000
        if (t === "course" || t === "knowledge") return -300
        return -600
      }))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .on("tick", () => {
        linkG.attr("d", (d: any) => {
          const sx = d.source.x, sy = d.source.y, tx = d.target.x, ty = d.target.y
          const mx = (sx + tx) / 2, my = (sy + ty) / 2, dx = tx - sx, dy = ty - sy
          return `M${sx},${sy} Q${mx - dy * 0.1},${my + dx * 0.1} ${tx},${ty}`
        })
        nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      })

    const dragBehavior = d3.drag<SVGGElement, SimNode>()
      .on("start", (ev, d) => { if (!ev.active) simulation.alphaTarget(SIMULATION_ALPHA).restart(); d.fx = d.x; d.fy = d.y })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y })
      .on("end", (ev, d) => { if (!ev.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
    nodeG.call(dragBehavior as any)

    nodeG.append("circle")
      .attr("r", (d) => highlightNodeIds?.has(d.id) ? TYPE_META_D3[d.type].radius + 3 : TYPE_META_D3[d.type].radius)
      .attr("fill", (d) => highlightNodeIds?.has(d.id) ? "#ef4444" : TYPE_META_D3[d.type].color)
      .attr("fill-opacity", (d) => highlightNodeIds?.has(d.id) ? 0.95 : 0.16)
      .attr("stroke", (d) => highlightNodeIds?.has(d.id) ? "#b91c1c" : TYPE_META_D3[d.type].color)
      .attr("stroke-opacity", (d) => highlightNodeIds?.has(d.id) ? 1 : 0.55)
      .attr("stroke-width", (d) => highlightNodeIds?.has(d.id) ? 4 : d.type === "position" ? 2 : 1.5)
      .attr("class", (d) => highlightNodeIds?.has(d.id) ? "node-highlight" : "")

    const foSize = (d: SimNode) => Math.max(TYPE_META_D3[d.type].radius * 0.75, 7)
    nodeG.append("foreignObject")
      .attr("x", (d) => -foSize(d)).attr("y", (d) => -foSize(d))
      .attr("width", (d) => foSize(d) * 2).attr("height", (d) => foSize(d) * 2)
      .append("xhtml:div")
      .style("display", "flex").style("align-items", "center").style("justify-content", "center")
      .style("height", "100%").style("pointer-events", "none")
      .each(function (d) {
        const div = this as HTMLElement
        div.style.color = highlightNodeIds?.has((d as SimNode).id) ? "#ffffff" : TYPE_META_D3[(d as SimNode).type].color
        div.innerHTML = ""
        const icon = getD3IconSvg((d as SimNode).type)
        if (icon) div.appendChild(icon)
      })

    nodeG.append("text")
      .attr("dy", (d) => TYPE_META_D3[d.type].radius + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => TYPE_META_D3[d.type].fontSize)
      .attr("fill", "#64748b")
      .attr("font-weight", (d) => d.type === "position" ? 600 : 400)
      .attr("pointer-events", "none")
      .text((d) => d.label.length > 10 ? d.label.slice(0, 10) + "\u2026" : d.label)

    const tooltip = d3.select(tooltipRef.current!)

    nodeG.on("click", (_event, d) => setSelectedId(d.id))
      .on("mouseover", (ev, d) => {
        tooltip.style("display", "block")
          .html(`<strong>${d.label}</strong><br><span style="font-size:10px;opacity:0.8">${TYPE_META_D3[d.type].label}</span>`)
      })
      .on("mousemove", (ev) => {
        const rect = containerRef.current!.getBoundingClientRect()
        tooltip.style("left", (ev.clientX - rect.left + 15) + "px").style("top", (ev.clientY - rect.top - 35) + "px")
      })
      .on("mouseout", () => tooltip.style("display", "none"))

    const updateStyles = () => {
      nodeG.select("circle")
        .attr("r", (d: any) => selectedId === d.id ? TYPE_META_D3[(d as SimNode).type].radius + 4 : highlightNodeIds?.has((d as SimNode).id) ? TYPE_META_D3[(d as SimNode).type].radius + 3 : TYPE_META_D3[(d as SimNode).type].radius)
        .attr("fill", (d: any) => highlightNodeIds?.has((d as SimNode).id) && selectedId !== d.id ? "#ef4444" : TYPE_META_D3[(d as SimNode).type].color)
        .attr("fill-opacity", (d: any) => selectedId === d.id ? 0.3 : highlightNodeIds?.has((d as SimNode).id) ? 0.95 : 0.16)
        .attr("stroke", (d: any) => highlightNodeIds?.has((d as SimNode).id) ? "#b91c1c" : TYPE_META_D3[(d as SimNode).type].color)
        .attr("stroke-opacity", (d: any) => selectedId === d.id || highlightNodeIds?.has((d as SimNode).id) ? 1 : 0.55)
        .attr("stroke-width", (d: any) => selectedId === d.id ? 2.5 : highlightNodeIds?.has((d as SimNode).id) ? 4 : d.type === "position" ? 2 : 1.5)
      nodeG.style("opacity", (d: any) => {
        if (!selectedId) return 1
        return connectedIds.has((d as SimNode).id) ? 1 : 0.12
      })
      nodeG.select("text").style("opacity", (d: any) => {
        if (!selectedId) return 1
        return connectedIds.has((d as SimNode).id) ? 1 : 0.15
      })
      linkG
        .attr("stroke", (d: any) => {
          if (!selectedId) return "#c8d8f0"
          const link = d as SimLink
          return connectedIds.has(link.source.id) && connectedIds.has(link.target.id) ? "#93c5fd" : "#e5e7eb"
        })
        .attr("opacity", (d: any) => {
          if (!selectedId) return 0.6
          const link = d as SimLink
          return connectedIds.has(link.source.id) && connectedIds.has(link.target.id) ? 0.8 : 0.1
        })
    }
    updateStyles()

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (ev) => g.attr("transform", ev.transform.toString()))

    svg.call(zoom as any).on("dblclick.zoom", null)
    zoomRef.current = zoom

    setTimeout(() => {
      const bounds = (gRef.current as SVGGElement).getBBox()
      const w = Math.max(bounds.width, 200), h = Math.max(bounds.height, 200)
      const scale = Math.min((0.85 * W) / w, (0.85 * H) / h, 1)
      const tx = W / 2 - scale * (bounds.x + w / 2)
      const ty = H / 2 - scale * (bounds.y + h / 2)
      svg.transition().duration(600).call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }, 800)

    return () => { simulation.stop(); svg.on(".zoom", null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredEdges, dims])

  useEffect(() => {
    if (!gRef.current) return
    const g = d3.select(gRef.current)
    const linkG = g.selectAll<SVGPathElement, SimLink>(".link-d3")
    const nodeG = g.selectAll<SVGGElement, SimNode>(".node-d3")

    const activeIds = selectedId ? connectedIds : (highlightNodeIds || null)

    nodeG.select("circle")
      .attr("r", (d: any) => selectedId === d.id ? TYPE_META_D3[(d as SimNode).type].radius + 4 : TYPE_META_D3[(d as SimNode).type].radius)
      .attr("fill-opacity", (d: any) => selectedId === d.id ? 0.3 : 0.16)
      .attr("stroke", (d: any) => TYPE_META_D3[(d as SimNode).type].color)
      .attr("stroke-opacity", (d: any) => selectedId === d.id ? 1 : 0.55)
      .attr("stroke-width", (d: any) => selectedId === d.id ? 2.5 : d.type === "position" ? 2 : 1.5)
    nodeG.style("opacity", (d: any) => {
      if (!activeIds) return 1
      return activeIds.has((d as SimNode).id) ? 1 : 0.35
    })
    nodeG.select("text").style("opacity", (d: any) => {
      if (!activeIds) return 1
      return activeIds.has((d as SimNode).id) ? 1 : 0.4
    })
    linkG
      .attr("stroke", (d: any) => {
        if (!activeIds) return "#c8d8f0"
        const link = d as SimLink
        return activeIds.has(link.source.id) && activeIds.has(link.target.id) ? "#93c5fd" : "#e5e7eb"
      })
      .attr("opacity", (d: any) => {
        if (!activeIds) return 0.6
        const link = d as SimLink
        return activeIds.has(link.source.id) && activeIds.has(link.target.id) ? 0.8 : 0.15
      })
  }, [selectedId, connectedIds, highlightNodeIds])

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy as any, 1.3)
  }
  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().call(zoomRef.current.scaleBy as any, 1 / 1.3)
  }
  const handleReset = () => {
    if (!svgRef.current || !zoomRef.current || !gRef.current) return
    const svg = d3.select(svgRef.current)
    const bounds = (gRef.current as SVGGElement).getBBox()
    const w = Math.max(bounds.width, 200), h = Math.max(bounds.height, 200)
    const scale = Math.min((0.85 * dims.width) / w, (0.85 * dims.height) / h, 1)
    const tx = dims.width / 2 - scale * (bounds.x + w / 2)
    const ty = dims.height / 2 - scale * (bounds.y + h / 2)
    svg.transition().duration(600).call(zoomRef.current.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale))
  }

  useEffect(() => {
    if (!svgRef.current || !zoomRef.current) return
    const ids = selectedId ? connectedIds : highlightNodeIds
    if (!ids) return
    const timer = setTimeout(() => {
      const svgEl = svgRef.current
      const zoom = zoomRef.current
      if (!svgEl || !zoom) return
      const nodes = simNodesRef.current.filter((n) => ids!.has(n.id))
      if (nodes.length === 0) return
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      nodes.forEach((n) => {
        const r = TYPE_META_D3[n.type].radius + 20
        minX = Math.min(minX, n.x - r)
        maxX = Math.max(maxX, n.x + r)
        minY = Math.min(minY, n.y - r)
        maxY = Math.max(maxY, n.y + r)
      })
      const bw = Math.max(maxX - minX, 60)
      const bh = Math.max(maxY - minY, 60)
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const DRAWER_W = selectedId ? 400 : 0
      const visW = Math.max(dims.width - DRAWER_W, 240)
      const scale = Math.min((0.55 * visW) / bw, (0.55 * dims.height) / bh, 1.2)
      const tx = visW / 2 - scale * cx
      const ty = dims.height / 2 - scale * cy
      d3.select(svgEl)
        .transition()
        .duration(600)
        .call(zoom.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale))
    }, 80)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, highlightNodeIds])

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
          <div className="flex items-center gap-1">{toolbarSlot}</div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-4">
        <div ref={containerRef} className={cn("relative h-full min-h-[200px] rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden", compact ? "lg:col-span-4" : "lg:col-span-3")}>
          <svg ref={svgRef} width={dims.width} height={dims.height} className="block w-full h-full">
            <defs>
              <marker id="arrow-d3" viewBox="0 -5 10 10" refX={20} refY={0} markerWidth={6} markerHeight={6} orient="auto">
                <path d="M0,-5L10,0L0,5" fill="#c8d8f0" />
              </marker>
            </defs>
            <g ref={gRef} />
          </svg>

          <div className="absolute top-3 left-3 flex gap-1 z-10">
            <button onClick={handleZoomIn} className="flex size-7 items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-500 hover:border-blue-400 hover:text-blue-500" title="放大">
              <ZoomIn className="size-3.5" />
            </button>
            <button onClick={handleZoomOut} className="flex size-7 items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-500 hover:border-blue-400 hover:text-blue-500" title="缩小">
              <ZoomOut className="size-3.5" />
            </button>
            <button onClick={handleReset} className="flex size-7 items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-500 hover:border-blue-400 hover:text-blue-500" title="重置">
              <RotateCcw className="size-3.5" />
            </button>
          </div>

          <div className="absolute top-3 right-3 bg-white/95 border border-slate-100 rounded-md px-2.5 py-1.5 text-[11px] z-10">
            <div className="font-semibold text-slate-400 mb-1">图例</div>
            {(["position", "domain", "unit", "knowledge", "course"] as const).map((t) => (
              <div key={t} className="flex items-center gap-1.5 mb-0.5 last:mb-0">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: TYPE_META_D3[t].color }} />
                <span className="text-slate-500">{nodeLabels?.[t] ?? TYPE_META_D3[t].label}</span>
              </div>
            ))}
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white">
            拖拽节点 · 滚轮缩放 · 点击节点查看详情
          </div>

          <div ref={tooltipRef} className="absolute hidden bg-black/75 text-white text-xs px-2.5 py-1.5 rounded-md pointer-events-none z-50 max-w-[220px] leading-relaxed" />
        </div>

        {!compact && (
          <Card className="lg:col-span-1 flex flex-col h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">节点详情</CardTitle>
              {selectedId && <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><X className="size-4" /></Button>}
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {selectedNode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: TYPE_META_D3[selectedNode.type].color }}>
                      {TYPE_META_D3[selectedNode.type].icon}
                    </div>
                    <div>
                      <div className="font-medium">{selectedNode.label}</div>
                      <Badge variant="outline" className="text-[10px]">{TYPE_META_D3[selectedNode.type].label}</Badge>
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
