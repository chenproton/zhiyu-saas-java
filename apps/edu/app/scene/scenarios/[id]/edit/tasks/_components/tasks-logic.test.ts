import { describe, it, expect } from 'vitest'
import type { TaskEvaluationMethod } from '@/lib/types/scene'
import {
  makeDefaultTaskState,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates,
  taskStateFromMethods,
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
  it('homework 方法还原为 exam', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['homework'] as TaskState['evaluationMethods']
    const config = taskStateToEvalRuleConfig(state)
    const updates = evalRuleConfigToTaskStateUpdates(config)
    expect(updates.evaluationMethods).toEqual(['exam'])
  })

  it('round-trip 保持方法权重', () => {
    const state = makeDefaultTaskState(1, 0)
    state.evaluationMethods = ['random_draw', 'review'] as TaskState['evaluationMethods']
    state.methodWeights = { random_draw: 50, review: 50 }
    const config = taskStateToEvalRuleConfig(state)
    const back = evalRuleConfigToTaskStateUpdates(config)
    expect(back.methodWeights).toEqual({ random_draw: 50, review: 50 })
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
})
