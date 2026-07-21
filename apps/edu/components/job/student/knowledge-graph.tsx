"use client"

import { useMemo, useState } from "react"
import { X, Briefcase, Lightbulb, BookOpen } from "lucide-react"
import type { CareerPosition, PositionAbilityBinding, AbilityPoint } from "@/lib/types/job"
import type { CareerPosition as RelatedPosition } from "@/lib/types"
import Link from "next/link"

interface KnowledgeGraphProps {
  position: CareerPosition
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  relatedPositions: RelatedPosition[]
}

interface Node {
  id: string
  name: string
  type: "core" | "ability" | "knowledge"
  x: number
  y: number
}

interface LinkItem {
  source: string
  target: string
}

export function KnowledgeGraph({ position, bindings, abilityPoints, relatedPositions }: KnowledgeGraphProps) {
  const [selected, setSelected] = useState<{ name: string; type: string; description?: string } | null>(null)

  const { nodes, links } = useMemo(() => {
    const abilityNameMap: Record<string, string> = {}
    abilityPoints.forEach((a) => { abilityNameMap[a.id] = a.name })

    const abilitySet = bindings
      .map((b) => ({ id: b.abilityPointId, name: abilityNameMap[b.abilityPointId] || b.domain || "能力点" }))
      .filter((a, i, arr) => a.id && arr.findIndex((x) => x.id === a.id) === i)
      .slice(0, 10)

    const knowledgeMap: Record<string, string[]> = {}
    abilityPoints.forEach((a) => {
      if (!knowledgeMap[a.id]) knowledgeMap[a.id] = []
      a.attributes?.forEach((attr) => {
        if (attr && !knowledgeMap[a.id].includes(attr)) knowledgeMap[a.id].push(attr)
      })
    })

    const knowledgeNodes: Node[] = []
    const knowledgeLinks: LinkItem[] = []
    const seen = new Set<string>()

    abilitySet.forEach((ab) => {
      const attrs = knowledgeMap[ab.id] || []
      attrs.slice(0, 3).forEach((attr) => {
        const kid = `k-${attr}`
        if (!seen.has(kid)) {
          seen.add(kid)
          knowledgeNodes.push({ id: kid, name: attr, type: "knowledge", x: 0, y: 0 })
        }
        knowledgeLinks.push({ source: ab.id, target: kid })
      })
    })

    const W = 600
    const H = 500
    const center = { x: W / 2, y: H / 2 }
    const coreR = 0
    const abilityR = 150
    const knowledgeR = 260

    const abilityNodes: Node[] = abilitySet.map((ab, i) => {
      const angle = (i / Math.max(abilitySet.length, 1)) * Math.PI * 2 - Math.PI / 2
      return {
        id: ab.id,
        name: ab.name,
        type: "ability",
        x: center.x + Math.cos(angle) * abilityR,
        y: center.y + Math.sin(angle) * abilityR,
      }
    })

    knowledgeNodes.forEach((k, i) => {
      const angle = (i / Math.max(knowledgeNodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      k.x = center.x + Math.cos(angle) * knowledgeR
      k.y = center.y + Math.sin(angle) * knowledgeR
    })

    return {
      nodes: [{ id: "core", name: position.shortName || position.name, type: "core", x: center.x, y: center.y }, ...abilityNodes, ...knowledgeNodes],
      links: [...abilitySet.map((ab) => ({ source: "core", target: ab.id })), ...knowledgeLinks],
    }
  }, [position, bindings, abilityPoints])

  const typeColor: Record<Node["type"], string> = { core: "#722ed1", ability: "#52c41a", knowledge: "#f59e0b" }
  const typeR: Record<Node["type"], number> = { core: 40, ability: 18, knowledge: 10 }

  const related = relatedPositions.filter((p) => p.id !== position.id).slice(0, 4)

  return (
    <div className="flex h-[600px] -m-6">
      <div className="flex-1 relative bg-[#fdfdff] rounded-bl-2xl overflow-hidden">
        <svg viewBox="0 0 600 500" className="w-full h-full">
          {links.map((l, i) => {
            const s = nodes.find((n) => n.id === l.source)
            const t = nodes.find((n) => n.id === l.target)
            if (!s || !t) return null
            return (
              <path
                key={i}
                d={`M${s.x},${s.y} Q${(s.x + t.x) / 2},${(s.y + t.y) / 2} ${t.x},${t.y}`}
                fill="none"
                stroke="#c8d8f0"
                strokeWidth={s.type === "core" ? 2 : 1}
                opacity={0.5}
              />
            )
          })}
          {nodes.map((n) => {
            const nodeType = n.type as Node["type"]
            return (
              <g
                key={n.id}
                transform={`translate(${n.x},${n.y})`}
                className="cursor-pointer"
                onClick={() => {
                  if (nodeType !== "core") setSelected({ name: n.name, type: nodeType })
                }}
              >
                <circle r={typeR[nodeType]} fill={typeColor[nodeType]} stroke="#fff" strokeWidth={nodeType === "core" ? 3 : 1.5} />
                <text
                  dy={typeR[nodeType] + 14}
                  textAnchor="middle"
                  fontSize={nodeType === "core" ? 13 : 10}
                  fill="#333"
                  fontWeight={nodeType === "core" ? 600 : 400}
                >
                  {n.name.length > 8 ? n.name.slice(0, 8) + "..." : n.name}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend */}
        <div className="absolute top-4 right-4 bg-white/95 border border-[#f5f5f4] rounded-xl p-3 shadow-sm text-xs">
          <div className="font-semibold text-[#64748b] mb-2 uppercase tracking-wide">图例</div>
          <div className="flex items-center gap-2 mb-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#722ed1]" />岗位核心</div>
          <div className="flex items-center gap-2 mb-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#52c41a]" />能力点</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />知识点</div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/55 text-white text-xs px-3 py-1 rounded-full pointer-events-none">
          点击能力点与知识点查看详情
        </div>
      </div>

      {/* Related panel */}
      <div className="w-64 shrink-0 bg-white border-l border-[#f5f5f4] rounded-br-2xl p-4 overflow-y-auto">
        <div className="text-sm font-semibold text-[#1f2937] mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-500" />
          相关岗位
        </div>
        <div className="flex flex-col gap-3">
          {related.length === 0 && <div className="text-xs text-[#94a3b8]">暂无相关岗位</div>}
          {related.map((pos, i) => {
            const colors = [
              "linear-gradient(135deg, #3b82f6, #60a5fa)",
              "linear-gradient(135deg, #52c41a, #73d13d)",
              "linear-gradient(135deg, #f59e0b, #ffc53d)",
              "linear-gradient(135deg, #722ed1, #b37feb)",
            ]
            return (
              <Link key={pos.id} href={`/job/student/${pos.id}`}>
                <div className="flex items-center gap-3 p-3 border border-[#f5f5f4] rounded-xl cursor-pointer hover:border-blue-200 hover:bg-[#eff6ff] transition-all">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg shrink-0" style={{ background: colors[i % colors.length] }}>
                    {pos.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#1f2937] truncate">{pos.name}</div>
                    <div className="text-xs text-[#64748b]">{pos.positionType === "enterprise" ? "企业岗位" : "教学岗位"}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-[440px] max-w-[95vw] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <div className="text-base font-semibold text-[#1f2937] flex items-center gap-2">
                {selected.type === "ability" ? <Lightbulb className="w-4 h-4 text-green-500" /> : <BookOpen className="w-4 h-4 text-amber-500" />}
                {selected.name}
              </div>
              <button className="text-[#94a3b8] hover:text-[#1f2937]" onClick={() => setSelected(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#64748b] leading-relaxed">
              {selected.type === "ability"
                ? `该能力要求掌握 ${selected.name} 的核心原理，能够独立完成相关任务并解决实际问题。`
                : `${selected.name} 是构建岗位能力体系的重要知识基础。`}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
