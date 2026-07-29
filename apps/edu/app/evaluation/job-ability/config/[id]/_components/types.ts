import type { LevelMapping } from "@/lib/types"

/** 认证规则配置页的本地草稿模型（key 为服务端 id 或本地临时 id） */

export interface DraftTask {
  key: string
  taskId: string
  taskName: string
  maxScore: number
  weight: number
}

export interface DraftPoint {
  key: string
  abilityPointId: string
  name: string
  description?: string
  mappingType: "inherit" | "custom"
  customLevelMapping?: LevelMapping[]
  requiredLevel: string
  weight: number
  tasks: DraftTask[]
}

export interface DraftItem {
  key: string
  name: string
  points: DraftPoint[]
}

export function newKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/** 给一组新节点分配权重：首个节点 100，其余 0（由用户再通过权重配置调整） */
export function defaultWeight(isFirst: boolean): number {
  return isFirst ? 100 : 0
}
