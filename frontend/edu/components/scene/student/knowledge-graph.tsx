'use client'

import { useMemo } from 'react'
import type { Scenario, ScenarioTask, KnowledgePoint, Course } from '@/lib/types'
import type { GraphNode, GraphEdge } from '@/components/knowledge-graph/types'
import { KnowledgeGraphShell } from '@/components/knowledge-graph/knowledge-graph-shell'
import { GraphDataProvider } from '@/components/knowledge-graph/graph-data-context'
import { useT } from '@/lib/i18n/locale-provider'

interface SceneKnowledgeGraphProps {
  scenario: Scenario
  tasks: ScenarioTask[]
  knowledgeMap: Map<string, KnowledgePoint>
  courseMap: Map<string, Course>
}

export function SceneKnowledgeGraph({
  scenario,
  tasks,
  knowledgeMap,
  courseMap,
}: SceneKnowledgeGraphProps) {
  const t = useT()
  const nodeLabels = {
    position: t('场景'),
    domain: t('任务'),
    knowledge: t('知识点'),
    course: t('颗粒课'),
  } as const
  const { nodes, edges } = useMemo(() => {
    const graphNodes: GraphNode[] = []
    const graphEdges: GraphEdge[] = []
    const edgeKeys = new Set<string>()
    const pushEdge = (source: string, target: string) => {
      const key = `${source}->${target}`
      if (edgeKeys.has(key)) return
      edgeKeys.add(key)
      graphEdges.push({ source, target })
    }

    const allKnowledgeIds = new Set<string>()
    tasks.forEach((t) => {
      t.knowledgePointIds?.forEach((kid) => allKnowledgeIds.add(kid))
    })

    if (tasks.length === 0 && allKnowledgeIds.size === 0) {
      return { nodes: graphNodes, edges: graphEdges }
    }

    graphNodes.push({
      id: scenario.id,
      label: scenario.name || t('场景'),
      type: 'position',
    })

    const knowledgeNodeIds = new Set<string>()
    tasks.forEach((task) => {
      graphNodes.push({
        id: task.id,
        label: task.name || task.code || t('任务'),
        type: 'domain',
      })
      pushEdge(scenario.id, task.id)

      task.knowledgePointIds?.forEach((kid) => {
        const kp = knowledgeMap.get(kid)
        if (!kp) return
        if (!knowledgeNodeIds.has(kid)) {
          knowledgeNodeIds.add(kid)
          graphNodes.push({
            id: kp.id,
            label: kp.name || kp.code || t('知识点'),
            type: 'knowledge',
          })
        }
        pushEdge(task.id, kp.id)
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
          graphNodes.push({ id: cid, label: course.name || t('颗粒课'), type: 'course' })
        }
        pushEdge(kid, cid)
      })
    })

    return { nodes: graphNodes, edges: graphEdges }
  }, [scenario, tasks, knowledgeMap, courseMap, t])

  const emptyView = (
    <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
      {t('暂无图谱数据')}
    </div>
  )

  return (
    <GraphDataProvider
      value={{
        mode: 'scene',
        scenario,
        tasks,
        knowledgePoints: knowledgeMap,
        courses: courseMap,
      }}
    >
      <KnowledgeGraphShell
        nodes={nodes}
        edges={edges}
        title={t('知识图谱')}
        description={t('场景 → 任务 → 知识点 → 颗粒课的关联网络')}
        nodeLabels={nodeLabels}
        emptyView={emptyView}
      />
    </GraphDataProvider>
  )
}
