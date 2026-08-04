import { describe, it, expect } from 'vitest'
import {
  taskStateFromMethods,
  taskStateToMethodsInput,
  taskStateToEvalRuleConfig,
  evalRuleConfigToTaskStateUpdates,
} from './tasks-logic'
import type { TaskEvaluationMethod } from '@/lib/types/scene'

const task11Methods = (): TaskEvaluationMethod[] => [
  {
    id: 'm1',
    taskId: 't1',
    methodKey: 'paper',
    weight: 0,
    evalObject: 'individual',
    evalSubjects: [],
    resourceConfig: { paperId: 'c4a216c7-9e80-4823-bf98-1e3e579b10d0', usageId: 'x', paperWeight: 100 },
    version: 14,
    isEnabled: true,
    evalPoints: [],
    reviewSteps: [],
  },
  {
    id: 'm2',
    taskId: 't1',
    methodKey: 'question_bank',
    weight: 0,
    evalObject: 'individual',
    evalSubjects: [],
    resourceConfig: {
      examId: 'e3ca4e13',
      questionIds: ['q1', 'q2', 'q3'],
      questionScores: {},
      examQuestionIds: ['q1', 'q2', 'q3'],
    },
    version: 14,
    isEnabled: true,
    evalPoints: [],
    reviewSteps: [],
  },
  {
    id: 'm3',
    taskId: 't1',
    methodKey: 'quiz',
    weight: 0,
    evalObject: 'individual',
    evalSubjects: [],
    resourceConfig: { examId: '8ffaff65', questionIds: ['q4', 'q5'], questionScores: {}, examQuestionIds: ['q4', 'q5'] },
    version: 14,
    isEnabled: true,
    evalPoints: [],
    reviewSteps: [],
  },
]

describe('round trip: load -> save', () => {
  it('preserves all enabled methods', () => {
    const ts = taskStateFromMethods(task11Methods())
    const payload = taskStateToMethodsInput(ts)
    console.log('evaluationMethods:', ts.evaluationMethods)
    console.log('disabledEvaluationMethods:', ts.disabledEvaluationMethods)
    console.log(
      'payload:',
      JSON.stringify(payload.map((m) => ({ k: m.methodKey, en: m.isEnabled }))),
    )
    expect(ts.evaluationMethods).toEqual(
      expect.arrayContaining(['paper', 'question_bank', 'quiz']),
    )
  })

  it('editor open (config conversion) then save preserves methods', () => {
    const ts = taskStateFromMethods(task11Methods())
    const config = taskStateToEvalRuleConfig(ts)
    const updates = evalRuleConfigToTaskStateUpdates(config)
    const ts2 = { ...ts, ...updates }
    const payload = taskStateToMethodsInput(ts2)
    console.log('after editor round trip evaluationMethods:', ts2.evaluationMethods)
    console.log(
      'payload2:',
      JSON.stringify(payload.map((m) => ({ k: m.methodKey, en: m.isEnabled }))),
    )
    expect(ts2.evaluationMethods).toEqual(
      expect.arrayContaining(['paper', 'question_bank', 'quiz']),
    )
  })

  it('保存评分规则(score_rule)后 load -> save 往返不丢失 standardMode/scoreRules', () => {
    const methods = task11Methods()
    const homework = methods.find((m) => m.methodKey === 'paper')!
    homework.methodKey = 'homework'
    homework.standardMode = 'score_rule'
    homework.standardName = '我的评分规则'
    homework.scoreRules = [
      { id: 'sr1', configId: 'm1', name: '规则一', description: 'd1', rule: 'r1', weight: 60, sortOrder: 0 },
      { id: 'sr2', configId: 'm1', name: '规则二', description: 'd2', rule: 'r2', weight: 40, sortOrder: 1 },
    ]
    const ts = taskStateFromMethods(methods)
    expect(ts.homeworkStandardMode).toBe('score_rule')
    expect(ts.homeworkStandardName).toBe('我的评分规则')
    expect(ts.homeworkScoreRules).toHaveLength(2)

    const payload = taskStateToMethodsInput(ts)
    const saved = payload.find((m) => m.methodKey === 'homework')
    expect(saved.standardMode).toBe('score_rule')
    expect(saved.standardName).toBe('我的评分规则')
    expect(saved.scoreRules).toHaveLength(2)
    expect(saved.evalPoints).toEqual([])
  })
})
