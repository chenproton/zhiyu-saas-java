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
})
