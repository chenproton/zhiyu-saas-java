'use client'

import { useMemo } from 'react'
import type { Scenario, ScenarioTask, KnowledgePoint } from '@/lib/types'
import type { GraphNode, GraphEdge } from '@/components/knowledge-graph/types'
import { KnowledgeGraphShell } from '@/components/knowledge-graph/knowledge-graph-shell'

const NODE_LABELS = {
  position: '场景',
  domain: '任务',
  knowledge: '知识点',
  course: '教材课件',
} as const

interface SceneKnowledgeGraphProps {
  scenario: Scenario
  tasks: ScenarioTask[]
  knowledgeMap: Map<string, KnowledgePoint>
}

export function SceneKnowledgeGraph({ scenario, tasks, knowledgeMap }: SceneKnowledgeGraphProps) {
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
      label: scenario.name || '场景',
      type: 'position',
    })

    tasks.forEach((task) => {
      graphNodes.push({
        id: task.id,
        label: task.name || task.code || '任务',
        type: 'domain',
      })
      graphEdges.push({ source: scenario.id, target: task.id })

      task.knowledgePointIds?.forEach((kid) => {
        const kp = knowledgeMap.get(kid)
        if (!kp) return
        graphNodes.push({
          id: kp.id,
          label: kp.name || kp.code || '知识点',
          type: 'knowledge',
        })
        graphEdges.push({ source: task.id, target: kp.id })
      })
    })

    return { nodes: graphNodes, edges: graphEdges }
  }, [scenario, tasks, knowledgeMap])

  const emptyView = (
    <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
      暂无图谱数据
    </div>
  )

  return (
    <KnowledgeGraphShell
      nodes={nodes}
      edges={edges}
      title="知识图谱"
      description="场景 → 任务 → 知识点的关联网络"
      nodeLabels={NODE_LABELS}
      emptyView={emptyView}
    />
  )
}
