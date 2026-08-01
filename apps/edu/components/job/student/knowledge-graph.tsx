"use client"

import { useMemo } from "react"
import type {
  CareerPosition,
  PositionAbilityBinding,
  AbilityPoint,
  AbilityDomain,
} from "@zhiyu/shared-types"
import { GraphDataProvider } from "@/components/knowledge-graph/graph-data-context"
import type { GraphNode, GraphEdge } from "@/components/knowledge-graph/types"
import { KnowledgeGraphShell } from "@/components/knowledge-graph/knowledge-graph-shell"

interface KnowledgeGraphProps {
  position: CareerPosition
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  abilityDomains: AbilityDomain[]
  relatedPositions: CareerPosition[]
}

export function KnowledgeGraph({
  position,
  bindings,
  abilityPoints,
  abilityDomains,
}: KnowledgeGraphProps) {
  const abilityPointMap = useMemo(() => {
    const map = new Map<string, AbilityPoint>()
    abilityPoints.forEach((ap) => map.set(ap.id, ap))
    return map
  }, [abilityPoints])

  const { nodes, edges, allDomains } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    // 岗位
    graphNodes.push({
      id: position.id,
      label: position.shortName || position.name,
      type: "position",
    })

    // 合并真实能力领域 + 从 binding.domain 生成的兜底领域
    const domainByName = new Map<string, AbilityDomain>()
    abilityDomains.forEach((d) => domainByName.set(d.name, d))

    const coveredBindingIds = new Set<string>()
    abilityDomains.forEach((d) => (d.bindingIds || []).forEach((id: string) => coveredBindingIds.add(id)))

    const fallbackDomains: AbilityDomain[] = []
    bindings.forEach((b) => {
      if (coveredBindingIds.has(b.id)) return
      const name = b.domain || "综合能力"
      if (!domainByName.has(name)) {
        domainByName.set(name, {
          id: `domain-fallback-${name}`,
          careerPositionId: position.id,
          name,
          bindingIds: [],
          sortOrder: 0,
        })
        fallbackDomains.push(domainByName.get(name)!)
      }
    })

    const allDomains = [...abilityDomains, ...fallbackDomains]

    // 能力领域节点
    allDomains.forEach((domain) => {
      graphNodes.push({ id: domain.id, label: domain.name, type: "domain" })
      graphEdges.push({ source: position.id, target: domain.id })
    })

    // 能力单元：通过 binding 关联到领域
    const unitNodeIds = new Set<string>()
    allDomains.forEach((domain) => {
      const domainBindingIds = new Set(domain.bindingIds || [])
      const hasExplicitBindings = domainBindingIds.size > 0
      bindings
        .filter((b) => {
          if (hasExplicitBindings) return domainBindingIds.has(b.id)
          return (b.domain || "综合能力") === domain.name
        })
        .forEach((b) => {
          const abilityPoint = abilityPointMap.get(b.abilityPointId)
          const unitId = abilityPoint?.id || b.abilityPointId
          const unitLabel = abilityPoint?.name || b.domain || "未命名能力"
          if (!unitNodeIds.has(unitId)) {
            unitNodeIds.add(unitId)
            graphNodes.push({ id: unitId, label: unitLabel, type: "unit" })
          }
          graphEdges.push({ source: domain.id, target: unitId })
        })
    })

    // 知识点与教材课件保留结构，暂不生成节点和边

    return { nodes: graphNodes, edges: graphEdges, allDomains }
  }, [position, abilityDomains, bindings, abilityPointMap])

  const graphData = useMemo(
    () => ({
      position,
      domains: allDomains,
      units: abilityPoints,
      bindings,
    }),
    [position, allDomains, abilityPoints, bindings]
  )

  return (
    <GraphDataProvider value={graphData}>
      <KnowledgeGraphShell
        nodes={nodes}
        edges={edges}
        title="知识图谱"
        description="岗位→能力领域→能力单元→知识点→教材课件的完整关联网络（当前仅展示前三级）"
      />
    </GraphDataProvider>
  )
}
