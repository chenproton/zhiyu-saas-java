import { describe, it, expect } from 'vitest'
import {
  createDefaultNodeModuleData,
  type NodeModuleData,
  type AtomicModuleKey,
} from './atomic-modules'
import {
  applyModuleData,
  buildModulesForNode,
  moduleDataFor,
  TEACHING_DESIGN_KEY,
  POST_LESSON_REVIEW_KEY,
} from './module-serialize'

function fillModule(d: NodeModuleData, key: AtomicModuleKey) {
  switch (key) {
    case 'prePreview':
      d.previewContent = '预习阅读材料'
      d.previewAttachments = [{ id: 'a1', name: '讲义.pdf', file: 'https://cdn/x.pdf' }]
      break
    case 'preQuizzes':
      d.preQuizEvalMethods = ['quiz']
      d.preQuizEvalRules = { evaluationMethods: ['quiz'], methodWeights: { quiz: 100 } } as any
      break
    case 'lecture':
      d.lectureContent = '讲授内容'
      d.lectureSections = [
        { id: 's1', name: '导入', content: '案例导入', attachments: [] },
      ]
      break
    case 'homeworks':
      d.homeworkEvalMethods = ['homework']
      d.homeworkEvalRules = {
        evaluationMethods: ['homework'],
        methodWeights: { homework: 100 },
      } as any
      d.homeworks = [{ id: 'h1', requirement: '完成实验报告', allowText: true, allowAttachment: true, deadline: '' }]
      break
    case 'classQuestions':
      d.classQuestions = [{ id: 'q1', stem: '什么是混合式教学？', answer: '线上+线下' }]
      break
    case 'trainingReports':
      d.trainingReports = [
        { id: 'r1', name: '实训报告', template: '模板内容', requirement: '要求', required: true, attachments: [] },
      ]
      break
    default:
      break
  }
}

describe('module-serialize round-trip', () => {
  it('builds payloads and restores NodeModuleData without loss', () => {
    const keys: AtomicModuleKey[] = [
      'prePreview',
      'preResources',
      'preTasks',
      'preQuizzes',
      'lecture',
      'inClassTasks',
      'inClassQuizzes',
      'classQuestions',
      'practiceTasks',
      'homeworks',
      'extensionMaterials',
      'trainingReports',
    ]
    const d = createDefaultNodeModuleData()
    d.teachingDesignContent = '教学设计：知识目标……'
    d.postLessonReviewContent = '课后总结：学生反馈良好'
    d.teachingDesignGroups = [
      { id: 'dg-1', name: '复用组一' },
      { id: 'dg-2', name: '复用组二' },
    ]
    keys.forEach((k) => fillModule(d, k))
    d.moduleModes = { preQuizzes: 'online', lecture: 'offline' }

    const payloads = buildModulesForNode(d, keys)
    expect(payloads.length).toBeGreaterThan(0)
    expect(payloads.map((p) => p.moduleKey)).toContain(TEACHING_DESIGN_KEY)
    expect(payloads.map((p) => p.moduleKey)).toContain(POST_LESSON_REVIEW_KEY)

    // 还原到新对象，逐字段比对
    const restored = createDefaultNodeModuleData()
    payloads.forEach((p) => {
      applyModuleData(restored, p)
      if (p.mode) restored.moduleModes = { ...restored.moduleModes, [p.moduleKey]: p.mode }
    })

    expect(restored.teachingDesignContent).toBe(d.teachingDesignContent)
    expect(restored.teachingDesignGroups).toEqual([
      { id: 'dg-1', name: '复用组一' },
      { id: 'dg-2', name: '复用组二' },
    ])
    expect(restored.postLessonReviewContent).toBe(d.postLessonReviewContent)
    expect(restored.previewContent).toBe(d.previewContent)
    expect(restored.previewAttachments).toEqual(d.previewAttachments)
    expect(restored.lectureContent).toBe(d.lectureContent)
    expect(restored.lectureSections).toEqual(d.lectureSections)
    expect(restored.classQuestions).toEqual(d.classQuestions)
    expect(restored.homeworks).toEqual(d.homeworks)
    expect(restored.trainingReports).toEqual(d.trainingReports)
    expect(restored.preQuizEvalMethods).toEqual(['quiz'])
    expect(restored.homeworkEvalMethods).toEqual(['homework'])
    expect(restored.moduleModes?.preQuizzes).toBe('online')
    expect(restored.moduleModes?.lecture).toBe('offline')
  })

  it('skips empty modules', () => {
    const d = createDefaultNodeModuleData()
    const payloads = buildModulesForNode(d, ['prePreview', 'preTasks'])
    expect(payloads.length).toBe(0)
  })

  it('extracts per-module data fields', () => {
    const d = createDefaultNodeModuleData()
    d.previewAttachments = [{ id: 'a', name: 'x', file: 'y' }]
    const data = moduleDataFor('prePreview', d)
    expect(data.attachments).toEqual(d.previewAttachments)
    expect(data.content).toBe('')
  })
})
