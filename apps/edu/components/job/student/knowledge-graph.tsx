'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  CareerPosition,
  PositionAbilityBinding,
  AbilityPoint,
  AbilityDomain,
  ScenarioTask,
  KnowledgePoint,
  Course,
} from '@zhiyu/shared-types'
import { knowledgeApi, courseApi } from '@/lib/api'
import { GraphDataProvider } from '@/components/knowledge-graph/graph-data-context'
import type { GraphNode, GraphEdge } from '@/components/knowledge-graph/types'
import { KnowledgeGraphShell } from '@/components/knowledge-graph/knowledge-graph-shell'

interface KnowledgeGraphProps {
  position: CareerPosition
  bindings: PositionAbilityBinding[]
  abilityPoints: AbilityPoint[]
  abilityDomains: AbilityDomain[]
  relatedPositions: CareerPosition[]
  tasks: ScenarioTask[]
}

export function KnowledgeGraph({
  position,
  bindings,
  abilityPoints,
  abilityDomains,
  tasks,
}: KnowledgeGraphProps) {
  const [knowledgeMap, setKnowledgeMap] = useState<Map<string, KnowledgePoint>>(new Map())
  const [courseMap, setCourseMap] = useState<Map<string, Course>>(new Map())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      knowledgeApi.list({ limit: 1000 }).catch(() => ({ items: [], total: 0 })),
      courseApi.list({ type: 'granular', limit: 1000 }).catch(() => ({ items: [], total: 0 })),
    ]).then(([kRes, cRes]) => {
      if (cancelled) return
      const kMap = new Map<string, KnowledgePoint>()
      ;(kRes.items || []).forEach((k) => kMap.set(k.id, k))
      setKnowledgeMap(kMap)
      const cMap = new Map<string, Course>()
      ;(cRes.items || []).forEach((c) => cMap.set(c.id, c))
      setCourseMap(cMap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const abilityPointMap = useMemo(() => {
    const map = new Map<string, AbilityPoint>()
    abilityPoints.forEach((ap) => map.set(ap.id, ap))
    return map
  }, [abilityPoints])

  const { nodes, edges, allDomains } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []
    const edgeKeys = new Set<string>()
    const pushEdge = (source: string, target: string) => {
      const key = `${source}->${target}`
      if (edgeKeys.has(key)) return
      edgeKeys.add(key)
      graphEdges.push({ source, target })
    }

    // 岗位
    graphNodes.push({
      id: position.id,
      label: position.shortName || position.name,
      type: 'position',
    })

    // 合并真实能力领域 + 从 binding.domain 生成的兜底领域
    const domainByName = new Map<string, AbilityDomain>()
    abilityDomains.forEach((d) => domainByName.set(d.name, d))

    const coveredBindingIds = new Set<string>()
    abilityDomains.forEach((d) =>
      (d.bindingIds || []).forEach((id: string) => coveredBindingIds.add(id)),
    )

    const fallbackDomains: AbilityDomain[] = []
    bindings.forEach((b) => {
      if (coveredBindingIds.has(b.id)) return
      const name = b.domain || '综合能力'
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
      graphNodes.push({ id: domain.id, label: domain.name, type: 'domain' })
      pushEdge(position.id, domain.id)
    })

    // 能力点：通过 binding 关联到领域
    const unitNodeIds = new Set<string>()
    allDomains.forEach((domain) => {
      const domainBindingIds = new Set(domain.bindingIds || [])
      const hasExplicitBindings = domainBindingIds.size > 0
      bindings
        .filter((b) => {
          if (hasExplicitBindings) return domainBindingIds.has(b.id)
          return (b.domain || '综合能力') === domain.name
        })
        .forEach((b) => {
          const abilityPoint = abilityPointMap.get(b.abilityPointId)
          const unitId = abilityPoint?.id || b.abilityPointId
          const unitLabel = abilityPoint?.name || b.domain || '未命名能力'
          if (!unitNodeIds.has(unitId)) {
            unitNodeIds.add(unitId)
            graphNodes.push({ id: unitId, label: unitLabel, type: 'unit' })
          }
          pushEdge(domain.id, unitId)
        })
    })

    // 能力点 → 知识点：同一任务同时关联能力点与知识点即视为关联
    const unitKnowledgeIds = new Map<string, Set<string>>()
    tasks.forEach((t) => {
      ;(t.abilityPointIds || []).forEach((aid) => {
        ;(t.knowledgePointIds || []).forEach((kid) => {
          let set = unitKnowledgeIds.get(aid)
          if (!set) {
            set = new Set()
            unitKnowledgeIds.set(aid, set)
          }
          set.add(kid)
        })
      })
    })

    const knowledgeNodeIds = new Set<string>()
    unitNodeIds.forEach((unitId) => {
      ;(unitKnowledgeIds.get(unitId) || []).forEach((kid) => {
        const kp = knowledgeMap.get(kid)
        if (!kp) return
        if (!knowledgeNodeIds.has(kid)) {
          knowledgeNodeIds.add(kid)
          graphNodes.push({ id: kid, label: kp.name, type: 'knowledge' })
        }
        pushEdge(unitId, kid)
      })
    })

    // 知识点 → 颗粒课：知识点绑定的颗粒课
    const courseNodeIds = new Set<string>()
    knowledgeNodeIds.forEach((kid) => {
      const kp = knowledgeMap.get(kid)
      ;(kp?.granularLessonIds || []).forEach((cid) => {
        const course = courseMap.get(cid)
        if (!course) return
        if (!courseNodeIds.has(cid)) {
          courseNodeIds.add(cid)
          graphNodes.push({ id: cid, label: course.name, type: 'course' })
        }
        pushEdge(kid, cid)
      })
    })

    return { nodes: graphNodes, edges: graphEdges, allDomains }
  }, [position, abilityDomains, bindings, abilityPointMap, tasks, knowledgeMap, courseMap])

  const graphData = useMemo(
    () => ({
      position,
      domains: allDomains,
      units: abilityPoints,
      bindings,
      tasks,
      knowledgePoints: knowledgeMap,
      courses: courseMap,
    }),
    [position, allDomains, abilityPoints, bindings, tasks, knowledgeMap, courseMap],
  )

  return (
    <GraphDataProvider value={graphData}>
      <KnowledgeGraphShell
        nodes={nodes}
        edges={edges}
        title="知识图谱"
        description="岗位→能力领域→能力点→知识点→颗粒课的完整关联网络（知识点经任务绑定关联能力点，颗粒课经知识点绑定关联）"
      />
    </GraphDataProvider>
  )
}
