import { describe, it, expect } from 'vitest'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import type { EvalRuleConfig } from '@/lib/types/evaluation'
import {
  buildEvalDataForSave,
  buildNodeSavePayload,
  nodeToDraft,
  resolveKnowledgePointIds,
  resolveResourceIds,
} from './lesson-save-utils'

function makeEvalRuleConfig(methods: string[] = ['paper']): EvalRuleConfig {
  return {
    evaluationMethods: methods as any,
    disabledEvaluationMethods: [],
    methodWeights: { paper: 100 },
    evalObject: 'individual',
    methodEvalObjects: { paper: 'individual' },
    evalSubjects: [],
    methodEvalSubjects: {},
    randomDrawQuestions: [],
    randomDrawCustomQuestions: [],
    randomDrawSelectedIds: [],
    randomDrawEvalPoints: [],
    randomDrawScoreType: 'eval_points',
    randomDrawRubricId: null,
    reviewEvalPoints: [],
    reviewScoreType: 'eval_points',
    reviewRubricId: null,
    reviewSteps: [],
    paperIds: ['paper-1'],
    paperWeights: { 'paper-1': 100 },
    paperEvalPoints: [
      {
        id: 'ep-1',
        name: '完成度',
        desc: '任务完成程度',
        weight: 100,
        scoringMethod: 'score',
        gradeMapping: [],
      },
    ],
    questionBankQuestions: [],
    questionBankEvalPoints: [],
    outcomeEvalPoints: [],
    outcomeScoreType: 'eval_points',
    outcomeRubricId: null,
    homeworkEvalPoints: [],
    homeworkScoreType: 'eval_points',
    homeworkRubricId: null,
    quizQuestions: [],
    quizEvalPoints: [],
    gradeMapping: [],
    methodResourceConfigs: { paper: { requiresMaterial: true } },
  }
}

function makeNode(overrides: Partial<SystemCourseNode> = {}): SystemCourseNode {
  return {
    id: 'node-1',
    courseId: 'course-1',
    parentId: null,
    name: '测试节点',
    code: 'CNT-TEST',
    order: 1,
    type: 'normal',
    status: 'draft',
    teachingGoals: '原始学习目标',
    detailedDescription: '原始详细说明',
    descriptionPdf: undefined,
    background: '',
    estimatedHours: 2,
    duration: 2,
    difficulty: 3,
    knowledgePoints: [
      { id: 'kp-1', name: '知识点一', code: 'KP001', linked: true },
      { id: 'kp-2', name: '知识点二', code: 'KP002', linked: true },
    ],
    resources: [
      { id: 'res-1', name: '资源一', type: 'pdf', size: 1024, url: 'https://example.com/1.pdf' },
    ],
    evalData: {
      methods: ['paper'],
      evalRuleConfig: makeEvalRuleConfig(),
    },
    ...overrides,
  }
}

describe('lesson admin system add save round-trip', () => {
  it('保存 payload 中 evalRuleConfig 与 draft 一致，回显后仍一致', () => {
    const evalRuleConfig = makeEvalRuleConfig(['paper', 'question_bank'])
    evalRuleConfig.methodWeights = { paper: 60, question_bank: 40 }
    evalRuleConfig.questionBankQuestions = ['q-1', 'q-2']

    const node = makeNode()
    const draft = nodeToDraft(node)
    draft.evalData = {
      methods: ['paper', 'question_bank'],
      evalRuleConfig,
    }

    const payload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId: 'course-1',
      contentCode: 'CNT-TEST',
      resolvedKnowledgePointIds: [],
      existingResourceIds: [],
    })

    expect(payload.evalData.methods).toEqual(['paper', 'question_bank'])
    expect(payload.evalData.evalRuleConfig).toEqual(evalRuleConfig)

    // 模拟后端回显：把 payload.evalData 写回 node.evalData
    const savedNode: SystemCourseNode = { ...node, evalData: payload.evalData }
    const echoDraft = nodeToDraft(savedNode)

    expect(echoDraft.evalData?.methods).toEqual(['paper', 'question_bank'])
    expect(echoDraft.evalData?.evalRuleConfig).toEqual(evalRuleConfig)
  })

  it('draft 未修改 evalRuleConfig 时，node 原有的 evalRuleConfig 仍被保存', () => {
    const node = makeNode()
    const draft = nodeToDraft(node)
    // draft.evalData 仍保留原 methods，但 evalRuleConfig 与原 node 相同
    // 用户只修改了知识点
    draft.knowledgePoints = [
      { id: 'kp-1', name: '知识点一', code: 'KP001', linked: true },
    ]

    const payload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId: 'course-1',
      contentCode: 'CNT-TEST',
      resolvedKnowledgePointIds: ['kp-1'],
      existingResourceIds: [],
    })

    expect(payload.evalData.evalRuleConfig).toEqual(node.evalData?.evalRuleConfig)
  })

  it('知识点 ID 在保存 payload 与回显后保持一致', () => {
    const node = makeNode()
    const draft = nodeToDraft(node)
    draft.knowledgePoints = [
      { id: 'kp-1', name: '知识点一', code: 'KP001', linked: true },
      { id: 'kp-custom-1', name: '自定义知识点', linked: false },
    ]

    const idMapping = new Map<string, string>([['kp-custom-1', 'kp-real-99']])
    const knowledgePointIds = resolveKnowledgePointIds(draft.knowledgePoints, idMapping)

    expect(knowledgePointIds).toEqual(['kp-1', 'kp-real-99'])

    const payload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId: 'course-1',
      contentCode: 'CNT-TEST',
      resolvedKnowledgePointIds: knowledgePointIds,
      existingResourceIds: [],
    })

    expect(payload.knowledgePointIds).toEqual(['kp-1', 'kp-real-99'])

    // 模拟后端回显
    const savedNode: SystemCourseNode = {
      ...node,
      knowledgePoints: draft.knowledgePoints.filter((kp) => !kp.id.startsWith('kp-custom-')),
    }
    const echoDraft = nodeToDraft(savedNode)
    expect(echoDraft.knowledgePoints.map((kp) => kp.id)).toEqual(['kp-1'])
  })

  it('资源 ID 在保存 payload 与回显后保持一致', () => {
    const node = makeNode()
    const draft = nodeToDraft(node)
    draft.selectedResourceIds = ['lib-1', 'lib-2', 'res-temp-1']

    const resourcePool = [
      { id: 'lib-1', name: '资源一', type: 'pdf' },
      { id: 'lib-2', name: '资源二', type: 'video' },
      { id: 'res-temp-1', name: '本地资源', type: 'pdf' },
    ]

    const { existingResourceIds, localResources } = resolveResourceIds(
      draft.selectedResourceIds,
      resourcePool,
      node.id,
    )

    expect(existingResourceIds).toEqual(['lib-1', 'lib-2'])
    expect(localResources.map((r) => r.id)).toEqual(['res-temp-1'])

    const payload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId: 'course-1',
      contentCode: 'CNT-TEST',
      resolvedKnowledgePointIds: [],
      existingResourceIds,
    })

    expect(payload.resourceIds).toEqual(['lib-1', 'lib-2'])

    // 模拟后端回显：payload 中的 resourceIds 绑定后，resources 只包含已入库资源
    const savedNode: SystemCourseNode = {
      ...node,
      resources: [
        { id: 'lib-1', name: '资源一', type: 'pdf', size: 0, url: '' },
        { id: 'lib-2', name: '资源二', type: 'video', size: 0, url: '' },
        { id: 'res-real-1', name: '本地资源', type: 'pdf', size: 0, url: '' },
      ],
    }
    const echoDraft = nodeToDraft(savedNode)
    expect(echoDraft.selectedResourceIds).toEqual(['lib-1', 'lib-2', 'res-real-1'])
  })

  it('节点详细说明与 PDF 在保存 payload 与回显后保持一致', () => {
    const node = makeNode()
    const draft = nodeToDraft(node)
    draft.detailedDescription = '更新后的节点详细说明'
    draft.learningGoalPdf = 'https://example.com/description.pdf'

    const payload = buildNodeSavePayload({
      node,
      draft,
      effectiveCourseId: 'course-1',
      contentCode: 'CNT-TEST',
      resolvedKnowledgePointIds: [],
      existingResourceIds: [],
    })

    expect(payload.detailedDescription).toBe('更新后的节点详细说明')
    expect(payload.descriptionPdf).toBe('https://example.com/description.pdf')

    // 模拟后端回显
    const savedNode: SystemCourseNode = {
      ...node,
      detailedDescription: payload.detailedDescription,
      descriptionPdf: payload.descriptionPdf,
    }
    const echoDraft = nodeToDraft(savedNode)

    expect(echoDraft.detailedDescription).toBe('更新后的节点详细说明')
    expect(echoDraft.learningGoalPdf).toBe('https://example.com/description.pdf')
  })

  it('buildEvalDataForSave 不会用空 draft 覆盖 node 的 evalRuleConfig', () => {
    const nodeEvalData = {
      methods: ['paper'],
      evalRuleConfig: makeEvalRuleConfig(),
      extraField: 'keep',
    }
    const draftEvalData = { methods: ['paper'] }

    const result = buildEvalDataForSave(nodeEvalData, draftEvalData)
    expect(result.evalRuleConfig).toEqual(nodeEvalData.evalRuleConfig)
    expect(result.extraField).toBe('keep')
  })
})
