'use client'

import { createContext, useContext } from 'react'
import type {
  CareerPosition,
  AbilityDomain,
  AbilityPoint,
  PositionAbilityBinding,
  ScenarioTask,
  Scenario,
  KnowledgePoint,
  Course,
} from '@zhiyu/shared-types'

export interface GraphDataContext {
  position?: CareerPosition
  domains?: AbilityDomain[]
  units?: AbilityPoint[]
  bindings?: PositionAbilityBinding[]
  tasks?: ScenarioTask[]
  knowledgePoints?: Map<string, KnowledgePoint>
  courses?: Map<string, Course>
  /** 场景图谱模式：节点语义为 场景→任务→知识点→颗粒课（默认岗位模式：岗位→领域→能力点→知识点→颗粒课） */
  mode?: 'job' | 'scene'
  /** 场景图谱模式下的场景根节点（position 节点对应的数据源） */
  scenario?: Scenario
}

const GraphDataContext = createContext<GraphDataContext>({})

export function GraphDataProvider({
  value,
  children,
}: {
  value: GraphDataContext
  children: React.ReactNode
}) {
  return <GraphDataContext.Provider value={value}>{children}</GraphDataContext.Provider>
}

export function useGraphData(): GraphDataContext {
  return useContext(GraphDataContext)
}
