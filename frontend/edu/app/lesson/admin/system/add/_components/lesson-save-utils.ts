import type { SystemCourseNode, NodeRefType } from '@/lib/types/lesson-source'
import type { EvalRuleConfig } from '@/lib/types/evaluation'
import type { KnowledgePointItem } from '@/lib/types/lesson'
import type { ResourceItem } from '@/components/shared/resource-selector'

export interface NodeDraft {
  hours: string
  learningGoal: string
  learningGoalPdf: string | null
  detailedDescription: string
  background: string
  estimatedHours: string
  knowledgePoints: KnowledgePointItem[]
  selectedResourceIds: string[]
  selectedEvalMethods: string[]
  evalData?: { methods: string[]; evalRuleConfig?: EvalRuleConfig }
  difficulty: number
  coverImage?: string
}

export interface NodeSavePayload {
  courseId: string
  parentId?: string
  name: string
  code: string
  sortOrder: number
  refType: 'normal' | 'original'
  sourceId?: string
  sourceName?: string
  evalData: Record<string, any>
  status: string
  teachingGoals?: string
  descriptionPdf?: string
  detailedDescription?: string
  background?: string
  estimatedHours?: number
  duration?: number
  difficulty?: number
  knowledgePointIds?: string[]
  resourceIds?: string[]
}

/**
 * 合并 node.evalData 与 draft.evalData，确保 evalRuleConfig 不会被覆盖丢失。
 * 优先使用 draft 中的值，draft 不存在时回退到 node 中的值。
 */
export function buildEvalDataForSave(
  nodeEvalData?: Record<string, any>,
  draftEvalData?: { methods?: string[]; evalRuleConfig?: EvalRuleConfig },
): Record<string, any> {
  const merged: Record<string, any> = {
    ...(nodeEvalData || {}),
    ...(draftEvalData || {}),
  }
  const hasEvalRuleConfig =
    draftEvalData?.evalRuleConfig !== undefined || nodeEvalData?.evalRuleConfig !== undefined
  if (hasEvalRuleConfig) {
    merged.evalRuleConfig = draftEvalData?.evalRuleConfig ?? nodeEvalData?.evalRuleConfig
  }
  return merged
}

/**
 * 将知识点列表中的临时自定义 ID 替换为真实 ID。
 */
export function resolveKnowledgePointIds(
  knowledgePoints: KnowledgePointItem[],
  idMapping: Map<string, string>,
): string[] {
  return knowledgePoints
    .map((kp) => idMapping.get(kp.id) || kp.id)
    .filter((id) => !id.startsWith('kp-custom-'))
}

/**
 * 将资源 ID 列表拆分为已入库资源 ID 与本地临时资源。
 */
export function resolveResourceIds(
  selectedResourceIds: string[],
  resourcePool: ResourceItem[],
  nodeId?: string,
): { existingResourceIds: string[]; localResources: ResourceItem[] } {
  const existingResourceIds: string[] = []
  const localResources: ResourceItem[] = []
  for (const resId of selectedResourceIds) {
    const localRes = resourcePool.find((r) => r.id === resId)
    if (localRes && (resId.startsWith('res-') || !nodeId)) {
      localResources.push(localRes)
    } else {
      existingResourceIds.push(resId)
    }
  }
  return { existingResourceIds, localResources }
}

/**
 * 组装单个节点的保存 payload。
 * 注意：自定义知识点需要先在后端创建，得到真实 ID 后再调用此函数。
 */
export function buildNodeSavePayload(options: {
  node: SystemCourseNode
  draft?: NodeDraft
  effectiveCourseId: string
  parentId?: string
  contentCode: string
  resolvedKnowledgePointIds?: string[]
  existingResourceIds?: string[]
}): NodeSavePayload {
  const {
    node,
    draft,
    effectiveCourseId,
    parentId,
    contentCode,
    resolvedKnowledgePointIds = [],
    existingResourceIds = [],
  } = options

  const refType: NodeRefType = node.type === 'original' ? 'original' : 'normal'
  const isQuoteNode = refType === 'original'

  const payload: NodeSavePayload = {
    courseId: effectiveCourseId,
    parentId,
    name: node.name,
    code: contentCode,
    sortOrder: Math.round(node.order),
    refType,
    sourceId: node.sourceId,
    sourceName: node.sourceName,
    evalData: buildEvalDataForSave(node.evalData, draft?.evalData),
    status: node.status || 'draft',
  }

  if (!isQuoteNode) {
    Object.assign(payload, {
      // 可清空字段：draft 存在时直接透出草稿值（空串即显式清空），后端整列覆盖时清空生效
      teachingGoals: draft ? draft.learningGoal : node.teachingGoals,
      descriptionPdf: draft ? (draft.learningGoalPdf ?? undefined) : node.descriptionPdf,
      detailedDescription: draft ? draft.detailedDescription : node.detailedDescription,
      background: draft ? draft.background : node.background,
      estimatedHours: (() => {
        const v = draft?.estimatedHours
        // 显式清空（''）→ undefined；非数字输入 NaN 兜底为 undefined
        if (v === undefined || v === '') return undefined
        const n = parseFloat(v)
        return Number.isNaN(n) ? undefined : n
      })(),
      duration: (() => {
        const v = draft?.hours
        // 未编辑（无 draft）回退节点原值；显式清空（''）与非法输入均兜底为 0，与表单展示一致
        if (v === undefined) return node.duration
        if (v === '') return 0
        const n = parseFloat(v)
        return Number.isNaN(n) ? 0 : n
      })(),
      difficulty: draft?.difficulty ?? node.difficulty,
      knowledgePointIds: resolvedKnowledgePointIds,
      resourceIds: existingResourceIds,
    })
  }

  return payload
}

/**
 * 从已保存的节点回显到 draft 结构，用于验证 round-trip。
 */
export function nodeToDraft(node: SystemCourseNode): NodeDraft {
  const nodeEvalData = (node.evalData || {}) as {
    methods?: string[]
    evalRuleConfig?: EvalRuleConfig
  }
  return {
    hours: String(node.duration || ''),
    learningGoal: node.teachingGoals || '',
    learningGoalPdf: node.descriptionPdf || null,
    detailedDescription: node.detailedDescription || '',
    background: node.background || '',
    estimatedHours: node.estimatedHours ? String(node.estimatedHours) : '',
    knowledgePoints: (node.knowledgePoints || []).map((kp) => ({
      id: kp.id,
      name: kp.name,
      code: kp.code,
      description: kp.description,
      linked: true,
    })),
    selectedResourceIds: (node.resources || []).map((r) => r.id),
    selectedEvalMethods: nodeEvalData.methods || [],
    evalData: {
      methods: nodeEvalData.methods || [],
      evalRuleConfig: nodeEvalData.evalRuleConfig,
    },
    difficulty: node.difficulty || 0,
  }
}
