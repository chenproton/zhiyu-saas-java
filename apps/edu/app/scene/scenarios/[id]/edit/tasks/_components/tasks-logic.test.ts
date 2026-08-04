import { describe, it, expect } from 'vitest'
import type { TaskEvaluationMethod } from '@/lib/types/scene'
import {
  makeDefaultTaskState,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates,
  taskStateFromMethods,
  taskStateToMethodsInput,
  defaultGradeMapping,
  type TaskState,
} from './tasks-logic'

describe('makeDefaultTaskState', () => {
  it('权重均分且余数按顺序 +1', () => {
    const states = [0, 1, 2].map((i) => makeDefaultTaskState(3, i))
    expect(states.map((s) => s.weight)).toEqual([34, 33, 33])
  })

  it('count 为 0 时权重为 0', () => {
    expect(makeDefaultTaskState(0, 0).weight).toBe(0)
  })

  it('默认等级映射与全局一致（深拷贝）', () => {
    const s = makeDefaultTaskState(1, 0)
    expect(s.gradeMapping).toEqual(defaultGradeMapping)
    expect(s.gradeMapping).not.toBe(defaultGradeMapping)
  })
})

describe('taskStateToEvalRuleConfig', () => {
  it('exam 方法归一化为 homework', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['exam', 'review'] as TaskState['evaluationMethods']
    state.methodWeights = { exam: 60, review: 40 }
    const config = taskStateToEvalRuleConfig(state)
    expect(config.evaluationMethods).toEqual(['homework', 'review'])
    expect(config.methodWeights).toEqual({ homework: 60, review: 40 })
  })

  it('reviewSteps 映射 desc → description', () => {
    const state = makeDefaultTaskState(1, 0)
    state.reviewSteps = [{ label: '自评', desc: '说明', enabled: true, subjectType: 'self', weight: 100 }]
    const config = taskStateToEvalRuleConfig(state)
    expect(config.reviewSteps).toHaveLength(1)
    expect(config.reviewSteps[0].label).toBe('自评')
    expect(config.reviewSteps[0].description).toBe('说明')
    expect(config.reviewSteps[0].sortOrder).toBe(0)
  })
})

describe('evalRuleConfigToTaskStateUpdates', () => {
  it('homework 方法保持为 homework', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['homework'] as TaskState['evaluationMethods']
    const config = taskStateToEvalRuleConfig(state)
    const updates = evalRuleConfigToTaskStateUpdates(config)
    expect(updates.evaluationMethods).toEqual(['homework'])
  })

  it('round-trip 保持方法权重', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['random_draw', 'review'] as TaskState['evaluationMethods']
    state.methodWeights = { random_draw: 50, review: 50 }
    const config = taskStateToEvalRuleConfig(state)
    const back = evalRuleConfigToTaskStateUpdates(config)
    expect(back.methodWeights).toEqual({ random_draw: 50, review: 50 })
  })

  it('round-trip 评价规则资源/对象/主体均保持 homework 键', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['homework'] as TaskState['evaluationMethods']
    state.methodWeights = { homework: 100 }
    state.methodEvalObjects = { homework: 'group' }
    state.methodEvalSubjects = { homework: [{ type: 'teacher', enabled: true, params: { weightPercent: 100 } }] }
    state.methodResourceConfigs = { homework: { requiresMaterial: true, deadlineDays: 3 } }
    state.homeworkEvalPoints = [
      { id: 'ep-1', name: '完成度', desc: '', weight: 100, scoringMethod: 'score', gradeMapping: [] },
    ] as TaskState['homeworkEvalPoints']

    const config = taskStateToEvalRuleConfig(state)
    const back = evalRuleConfigToTaskStateUpdates(config)
    expect(back.evaluationMethods).toEqual(['homework'])
    expect(back.methodWeights).toEqual({ homework: 100 })
    expect(back.methodEvalObjects).toEqual({ homework: 'group' })
    expect(back.methodEvalSubjects).toEqual({ homework: [{ type: 'teacher', enabled: true, params: { weightPercent: 100 } }] })
    expect(back.methodResourceConfigs).toEqual({ homework: { requiresMaterial: true, deadlineDays: 3 } })

    const methods = taskStateToMethodsInput({ ...state, ...back } as TaskState)
    const homeworkMethod = methods.find((m) => m.methodKey === 'homework')
    expect(homeworkMethod).toBeDefined()
    expect(homeworkMethod?.evalObject).toBe('group')
    expect(homeworkMethod?.resourceConfig).toEqual({ requiresMaterial: true, deadlineDays: 3 })
    expect(homeworkMethod?.evalPoints).toHaveLength(1)
  })
})

describe('taskStateFromMethods', () => {
  it('空方法列表返回默认状态', () => {
    const state = taskStateFromMethods([])
    expect(state.evaluationMethods).toEqual([])
    expect(state.weight).toBe(0)
  })

  it('按方法初始化评价点字段', () => {
    const methods: TaskEvaluationMethod[] = [
      {
        id: 'm1',
        taskId: 't1',
        methodKey: 'random_draw',
        weight: 50,
        evalObject: 'individual',
        evalSubjects: [],
        resourceConfig: {},
        version: 1,
        isEnabled: true,
        evalPoints: [],
        reviewSteps: [],
      },
      {
        id: 'm2',
        taskId: 't1',
        methodKey: 'review',
        weight: 50,
        evalObject: 'individual',
        evalSubjects: [],
        resourceConfig: {},
        version: 1,
        isEnabled: true,
        evalPoints: [],
        reviewSteps: [],
      },
    ]
    const state = taskStateFromMethods(methods)
    expect(state.evaluationMethods).toContain('random_draw')
    expect(state.evaluationMethods).toContain('review')
  })

  it('历史 exam 方法加载后归一化为 homework', () => {
    const methods: TaskEvaluationMethod[] = [
      {
        id: 'm-old',
        taskId: 't1',
        methodKey: 'exam',
        weight: 100,
        evalObject: 'individual',
        evalSubjects: [{ type: 'teacher', enabled: true, params: { weightPercent: 100 } }],
        resourceConfig: { requiresMaterial: true, deadlineDays: 3 },
        version: 1,
        isEnabled: true,
        evalPoints: [{ id: 'ep-1', configId: 'm-old', name: '完成度', weight: 100, scoringMethod: 'score', sortOrder: 0 }],
        reviewSteps: [],
      },
    ]
    const state = taskStateFromMethods(methods)
    expect(state.evaluationMethods).toEqual(['homework'])
    expect(state.methodEvalObjects).toEqual({ homework: 'individual' })
    expect(state.methodEvalSubjects).toEqual({ homework: [{ type: 'teacher', enabled: true, params: { weightPercent: 100 } }] })
    expect(state.methodResourceConfigs).toEqual({ homework: { requiresMaterial: true, deadlineDays: 3 } })
    expect(state.homeworkEvalPoints).toHaveLength(1)
  })

  it('加载后端方法后保留 disabledEvaluationMethods，确保后续保存 payload 包含全量方法', () => {
    const methods: TaskEvaluationMethod[] = [
      {
        id: 'm-enabled',
        taskId: 't1',
        methodKey: 'question_bank',
        weight: 100,
        evalObject: 'individual',
        evalSubjects: [],
        resourceConfig: { questionIds: ['q1'] },
        version: 1,
        isEnabled: true,
        evalPoints: [],
        reviewSteps: [],
      },
      {
        id: 'm-disabled',
        taskId: 't1',
        methodKey: 'homework',
        weight: 0,
        evalObject: 'individual',
        evalSubjects: [],
        resourceConfig: {},
        version: 1,
        isEnabled: false,
        evalPoints: [],
        reviewSteps: [],
      },
    ]
    const state = taskStateFromMethods(methods)
    expect(state.evaluationMethods).toEqual(['question_bank'])
    expect(state.disabledEvaluationMethods).toEqual(['homework'])

    // 模拟用户新增一个测评方式后，payload 仍需包含原 disabled 方法，避免后端出现版本/状态漂移
    const stateWithNewMethod = {
      ...state,
      evaluationMethods: ['question_bank', 'review'],
      disabledEvaluationMethods: ['homework'],
      methodWeights: { question_bank: 50, review: 50 },
    }
    const payload = taskStateToMethodsInput(stateWithNewMethod)
    const enabledKeys = payload.filter((m) => m.isEnabled).map((m) => m.methodKey)
    const disabledKeys = payload.filter((m) => !m.isEnabled).map((m) => m.methodKey)
    expect(enabledKeys.sort()).toEqual(['question_bank', 'review'])
    expect(disabledKeys).toEqual(['homework'])
  })
})
