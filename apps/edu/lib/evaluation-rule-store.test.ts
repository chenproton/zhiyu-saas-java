import { describe, it, expect } from 'vitest'
import { reducer, type EvalRuleState } from './evaluation-rule-store'
import { makeDefaultEvalRuleConfig } from '@/lib/types/evaluation'

function makeState(methods = ['random_draw', 'review'] as EvalRuleState['evaluationMethods']) {
  return makeDefaultEvalRuleConfig(methods) as EvalRuleState
}

describe('evalRuleReducer SET_METHOD_WEIGHT', () => {
  it('权重钳制在 0-100', () => {
    const state = makeState()
    const next = reducer(state, {
      type: 'SET_METHOD_WEIGHT',
      methodKey: 'random_draw',
      weight: 120,
    })
    expect(next.methodWeights.random_draw).toBe(100)
    const below = reducer(state, {
      type: 'SET_METHOD_WEIGHT',
      methodKey: 'random_draw',
      weight: -5,
    })
    expect(below.methodWeights.random_draw).toBe(0)
  })

  it('不修改其他方法的权重', () => {
    const state = makeState()
    const next = reducer(state, { type: 'SET_METHOD_WEIGHT', methodKey: 'random_draw', weight: 70 })
    expect(next.methodWeights.review).toBe(50)
  })
})

describe('evalRuleReducer DISTRIBUTE_WEIGHTS', () => {
  it('权重均分，余数按顺序 +1', () => {
    const state = makeState(['random_draw', 'review', 'paper'])
    const next = reducer(state, { type: 'DISTRIBUTE_WEIGHTS' })
    expect(next.methodWeights).toEqual({ random_draw: 34, review: 33, paper: 33 })
  })

  it('无测评方式时保持原状', () => {
    const state = makeState([])
    const next = reducer(state, { type: 'DISTRIBUTE_WEIGHTS' })
    expect(next.methodWeights).toEqual({})
  })
})

describe('evalRuleReducer MOVE_METHOD', () => {
  it('上移交换相邻方法', () => {
    const state = makeState()
    const next = reducer(state, { type: 'MOVE_METHOD_UP', index: 1 })
    expect(next.evaluationMethods).toEqual(['review', 'random_draw'])
  })

  it('首元素上移与末元素下移不生效', () => {
    const state = makeState()
    expect(reducer(state, { type: 'MOVE_METHOD_UP', index: 0 }).evaluationMethods).toEqual([
      'random_draw',
      'review',
    ])
    expect(reducer(state, { type: 'MOVE_METHOD_DOWN', index: 1 }).evaluationMethods).toEqual([
      'random_draw',
      'review',
    ])
  })
})

describe('evalRuleReducer ADD/UPDATE/REMOVE_EVAL_POINT', () => {
  it('新增评价点继承全局等级映射，且不修改原状态', () => {
    const state = makeState()
    const next = reducer(state, {
      type: 'ADD_EVAL_POINT',
      field: 'randomDrawEvalPoints',
      point: { name: '完成度' },
    })
    expect(next.randomDrawEvalPoints).toHaveLength(1)
    expect(next.randomDrawEvalPoints[0].name).toBe('完成度')
    expect(next.randomDrawEvalPoints[0].gradeMapping).toEqual(state.gradeMapping)
    expect(next.randomDrawEvalPoints[0].gradeMapping).not.toBe(state.gradeMapping)
    expect(state.randomDrawEvalPoints).toHaveLength(0)
  })

  it('未命名评价点使用默认名', () => {
    const state = makeState()
    const next = reducer(state, { type: 'ADD_EVAL_POINT', field: 'reviewEvalPoints', point: {} })
    expect(next.reviewEvalPoints[0].name).toBe('未命名评价点')
  })

  it('更新与删除指定 id 的评价点', () => {
    const state = reducer(makeState(), {
      type: 'ADD_EVAL_POINT',
      field: 'randomDrawEvalPoints',
      point: { name: '完成度' },
    })
    const id = state.randomDrawEvalPoints[0].id
    const updated = reducer(state, {
      type: 'UPDATE_EVAL_POINT',
      field: 'randomDrawEvalPoints',
      id,
      updates: { weight: 30 },
    })
    expect(updated.randomDrawEvalPoints[0].weight).toBe(30)
    const removed = reducer(updated, {
      type: 'REMOVE_EVAL_POINT',
      field: 'randomDrawEvalPoints',
      id,
    })
    expect(removed.randomDrawEvalPoints).toHaveLength(0)
  })
})

describe('evalRuleReducer TOGGLE_QUESTION', () => {
  it('重复切换在集合与移除间往返', () => {
    const state = makeState()
    const on = reducer(state, { type: 'TOGGLE_QUESTION', field: 'quizQuestions', id: 'q1' })
    expect(on.quizQuestions).toEqual(['q1'])
    const off = reducer(on, { type: 'TOGGLE_QUESTION', field: 'quizQuestions', id: 'q1' })
    expect(off.quizQuestions).toEqual([])
  })
})

describe('evalRuleReducer SET_REVIEW_STEPS', () => {
  it('同步写入 review 资源配置以兼容旧消费方', () => {
    const state = makeState()
    const steps = [{ label: '自评', enabled: true, weight: 100, sortOrder: 1 }]
    const next = reducer(state, { type: 'SET_REVIEW_STEPS', steps })
    expect(next.reviewSteps).toBe(steps)
    expect(next.methodResourceConfigs.review?.reviewSteps).toBe(steps)
  })
})

describe('evalRuleReducer 不可变性', () => {
  it('嵌套字段变更不污染原状态', () => {
    const state = makeState()
    reducer(state, { type: 'SET_METHOD_EVAL_OBJECT', methodKey: 'review', evalObject: 'group' })
    expect(state.methodEvalObjects.review).toBeUndefined()

    reducer(state, { type: 'TOGGLE_QUESTION', field: 'quizQuestions', id: 'q1' })
    expect(state.quizQuestions).toEqual([])
  })
})
