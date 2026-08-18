export type GraphNodeType = 'position' | 'domain' | 'unit' | 'knowledge' | 'course'

// 节点类型中文标签单一来源（graph-node-detail / knowledge-graph-view / d3-view 三处共用，
// 此前三份表各自维护 label）。
export const GRAPH_NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  position: '岗位',
  domain: '能力领域',
  unit: '能力点',
  knowledge: '知识点',
  course: '颗粒课',
}

export interface GraphNode {
  id: string
  label: string
  type: GraphNodeType
  level?: number
}

export interface GraphEdge {
  source: string
  target: string
}
