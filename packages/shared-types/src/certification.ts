// ==================== 岗位认证规则管理 ====================

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
  positionName: string
  status: RuleStatus
  ruleSource: 'inherit' | 'custom'
  abilityItems: EvalAbilityItem[]
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

export function calculateLevel(
  score: number,
  mapping: LevelMapping[],
): string {
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
  mappingType: "inherit" | "custom"
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
