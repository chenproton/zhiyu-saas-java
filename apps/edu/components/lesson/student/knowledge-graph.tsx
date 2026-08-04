'use client'

import { useMemo } from 'react'
import type { Course, KnowledgePoint } from '@/lib/types'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import type { GraphNode, GraphEdge } from '@/components/knowledge-graph/types'
import { KnowledgeGraphShell } from '@/components/knowledge-graph/knowledge-graph-shell'

const NODE_LABELS = {
  position: '课程',
  domain: '节点',
  knowledge: '知识点',
} as const

interface LessonKnowledgeGraphProps {
  course: Course
  nodes: SystemCourseNode[]
  knowledgeMap: Map<string, KnowledgePoint>
}

export function LessonKnowledgeGraph({ course, nodes, knowledgeMap }: LessonKnowledgeGraphProps) {
  const isGranular = course.type === 'granular'

  const { nodes: graphNodes, edges: graphEdges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []

    const pushKnowledge = (targetId: string, kp: KnowledgePoint) => {
      graphNodes.push({
        id: kp.id,
        label: kp.name || kp.code || '知识点',
        type: 'knowledge',
      })
      graphEdges.push({ source: targetId, target: kp.id })
    }

    graphNodes.push({
      id: course.id,
      label: course.name || '课程',
      type: 'position',
    })

    // 课程级知识点：颗粒课为二级结构（课程 → 知识点），体系课直接挂在课程根节点下
    ;(course.knowledgePointIds || []).forEach((kid) => {
      const kp = knowledgeMap.get(kid)
      if (kp) pushKnowledge(course.id, kp)
    })

    // 体系课/混合课：三级结构（课程 → 节点 → 知识点）
    if (!isGranular) {
      nodes.forEach((node) => {
        graphNodes.push({
          id: node.id,
          label: node.name || '节点',
          type: 'domain',
        })
        graphEdges.push({ source: course.id, target: node.id })
        ;(node.knowledgePoints || []).forEach((kp) => pushKnowledge(node.id, kp as KnowledgePoint))
      })
    }

    return { nodes: graphNodes, edges: graphEdges }
  }, [course, nodes, knowledgeMap, isGranular])

  const emptyView = (
    <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
      暂无图谱数据
    </div>
  )

  return (
    <KnowledgeGraphShell
      nodes={graphNodes}
      edges={graphEdges}
      title="知识图谱"
      description={isGranular ? '课程 → 知识点的关联网络' : '课程 → 节点 → 知识点的关联网络'}
      nodeLabels={NODE_LABELS}
      emptyView={emptyView}
    />
  )
}
