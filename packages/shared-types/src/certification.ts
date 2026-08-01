// ==================== 岗位认证规则管理 ====================

import type { CompetencyLevel } from './job-source'

export type RuleStatus =
  | 'draft' // 草稿
  | 'not_submitted' // 未提交
  | 'reviewing' // 审批中
  | 'rejected' // 已驳回
  | 'ready' // 待发布
  | 'published' // 已发布
  | 'none' // 无规则

export interface LevelMapping {
  level: string
  min: number
  max: number
}

export interface RelatedTask {
  id: string
  name: string
  maxScore: number
  weight: number
}

export interface EvalAbilityPoint {
  id: string
  name: string
  description: string
  mappingType: 'inherit' | 'custom'
  customMapping?: LevelMapping[]
  requiredLevel: string
  weight?: number
  relatedTasks: RelatedTask[]
}

export interface EvalAbilityItem {
  id: string
  name: string
  abilityPoints: EvalAbilityPoint[]
}

export interface CertificationRule {
  id: string
  careerPositionId: string
  status: RuleStatus
  ruleSource: 'inherit' | 'custom'
  /** 规则级全局等级映射（继承类能力点的默认评级区间），空数组表示未配置 */
  levelMapping?: LevelMapping[]
  createdAt?: string
  updatedAt?: string
  /** 演示系统兼容字段（聚合展示用），后端列表/详情接口不返回 */
  positionName?: string
  abilityItems?: EvalAbilityItem[]
}

export interface Position {
  id: string
  name: string
  positionCode: string
  professionalDirection: string
  relatedAbilityCount: number
  ruleStatus: RuleStatus
  lastUpdated: string
  updatedBy: string
}

export const defaultLevelMapping: LevelMapping[] = [
  { level: '不合格', min: 0, max: 60 },
  { level: '了解L1', min: 61, max: 70 },
  { level: '理解L2', min: 71, max: 80 },
  { level: '掌握L3', min: 81, max: 85 },
  { level: '熟练L4', min: 86, max: 95 },
  { level: '精通L5', min: 96, max: 100 },
]

export function calculateLevel(score: number, mapping: LevelMapping[]): string {
  for (const level of mapping) {
    if (score >= level.min && score <= level.max) {
      return level.level
    }
  }
  return '不合格'
}

// ==================== 认证能力点后端模型 ====================

export interface CertificationAbilityItem {
  id: string
  ruleId: string
  name: string
  sortOrder: number
}

export interface CustomLevelMapping {
  level: string
  min: number
  max: number
}

export interface CertificationAbilityPoint {
  id: string
  itemId: string
  abilityPointId: string
  mappingType: 'inherit' | 'custom'
  customLevelMapping?: CustomLevelMapping[]
  requiredLevel: string
  weight: number
}

export interface CertificationRelatedTask {
  id: string
  certPointId: string
  taskId: string
  maxScore: number
  weight: number
}

// ==================== 岗位能力模型（只读组装）与权重配置 ====================

/** 能力点下关联的场景任务（来自场景编辑页的关联，只读） */
export interface CertificationModelTask {
  taskId: string
  taskName: string
  scenarioName: string
  /** 任务得分占能力点得分的权重（点内合计 100，后端缺省时给均分默认） */
  weight: number
}

/** 岗位能力点（来自岗位编辑页的能力模型，只读） */
export interface CertificationModelPoint {
  abilityPointId: string
  name: string
  description: string
  requiredLevel: CompetencyLevel
  rubricDescription: string
  /** 能力点得分占岗位总评的权重（岗位内合计 100，后端缺省时给均分默认） */
  weight: number
  tasks: CertificationModelTask[]
}

/** 能力域分组 */
export interface CertificationModelDomain {
  name: string
  points: CertificationModelPoint[]
}

/** GET /evaluation/certifications/positions/{positionId}/model 响应 */
export interface CertificationPositionModel {
  /** 已保存的权重规则；null 表示尚未保存过权重 */
  rule: { id: string; status: RuleStatus } | null
  positionId: string
  domains: CertificationModelDomain[]
}

/** PUT /evaluation/certifications/positions/{positionId}/weights 请求体 */
export interface CertificationWeightsPayload {
  pointWeights: { abilityPointId: string; weight: number }[]
  taskWeights: { abilityPointId: string; taskId: string; weight: number }[]
}
