export type GraphNodeType = 'position' | 'domain' | 'unit' | 'knowledge' | 'course'

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
