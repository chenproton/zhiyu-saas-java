import type { AtomicModuleKey, NodeModuleData } from './atomic-modules'
import type { HybridModulePayload } from '@zhiyu/api-client'

export const TEACHING_DESIGN_KEY = 'teachingDesign'
export const POST_LESSON_REVIEW_KEY = 'postLessonReview'

export const POST_REVIEW_DEFAULT = '请输入课后总结内容'

// 原子模块 key → NodeModuleData 字段映射（教学过程/课后复盘的自定义子模块）
export function moduleDataFor(key: AtomicModuleKey, d: NodeModuleData): Record<string, any> {
  switch (key) {
    case 'prePreview':
      return { content: d.previewContent, attachments: d.previewAttachments }
    case 'preResources':
      return { resources: d.preClassResources }
    case 'preTasks':
      return { tasks: d.preClassTasks }
    case 'preQuizzes':
      return { evalMethods: d.preQuizEvalMethods, evalRules: d.preQuizEvalRules }
    case 'lecture':
      return {
        content: d.lectureContent,
        resources: d.lectureResources,
        sections: d.lectureSections,
      }
    case 'inClassTasks':
      return { tasks: d.inClassTasks }
    case 'inClassQuizzes':
      return { evalMethods: d.inClassQuizEvalMethods, evalRules: d.inClassQuizEvalRules }
    case 'classQuestions':
      return { questions: d.classQuestions }
    case 'practiceTasks':
      return { tasks: d.practiceTasks }
    case 'homeworks':
      return { evalMethods: d.homeworkEvalMethods, evalRules: d.homeworkEvalRules, items: d.homeworks }
    case 'extensionMaterials':
      return { resources: d.extensionMaterials }
    case 'trainingReports':
      return { reports: d.trainingReports }
    default:
      return {}
  }
}

function isEmptyData(data: Record<string, any>): boolean {
  return Object.values(data).every((v) => {
    if (v == null) return true
    if (Array.isArray(v)) return v.length === 0
    if (typeof v === 'string') return v === ''
    if (typeof v === 'object') return Object.keys(v).length === 0
    return false
  })
}

// 构建某节点的全部模块持久化 payload（教学设计/课后复盘为空时不落库）。
export function buildModulesForNode(
  d: NodeModuleData,
  moduleKeys: AtomicModuleKey[],
): HybridModulePayload[] {
  const modules: HybridModulePayload[] = []
  if (d.teachingDesignContent || (d.teachingDesignGroups || []).length > 0) {
    modules.push({
      moduleKey: TEACHING_DESIGN_KEY,
      mode: 'offline',
      data: {
        content: d.teachingDesignContent,
        groups: d.teachingDesignGroups || [],
      },
    })
  }
  if (d.postLessonReviewContent && d.postLessonReviewContent !== POST_REVIEW_DEFAULT) {
    modules.push({
      moduleKey: POST_LESSON_REVIEW_KEY,
      mode: 'offline',
      data: { content: d.postLessonReviewContent },
    })
  }
  moduleKeys.forEach((key) => {
    const data = moduleDataFor(key, d)
    if (isEmptyData(data)) return
    modules.push({ moduleKey: key, mode: d.moduleModes?.[key] || 'offline', data })
  })
  return modules
}

// 将后端模块数据回填到 NodeModuleData。
export function applyModuleData(
  d: NodeModuleData,
  m: { moduleKey: string; data?: Record<string, any> },
): NodeModuleData {
  const data = m.data || {}
  switch (m.moduleKey) {
    case TEACHING_DESIGN_KEY:
      d.teachingDesignContent = data.content || ''
      d.teachingDesignGroups = Array.isArray(data.groups) ? data.groups : []
      break
    case POST_LESSON_REVIEW_KEY:
      d.postLessonReviewContent = data.content || ''
      break
    case 'prePreview':
      d.previewContent = data.content || ''
      d.previewAttachments = data.attachments || []
      break
    case 'preResources':
      d.preClassResources = data.resources || []
      break
    case 'preTasks':
      d.preClassTasks = data.tasks || []
      break
    case 'preQuizzes':
      d.preQuizEvalMethods = data.evalMethods || []
      d.preQuizEvalRules = data.evalRules
      break
    case 'lecture':
      d.lectureContent = data.content || ''
      d.lectureResources = data.resources || []
      d.lectureSections = data.sections || []
      break
    case 'inClassTasks':
      d.inClassTasks = data.tasks || []
      break
    case 'inClassQuizzes':
      d.inClassQuizEvalMethods = data.evalMethods || []
      d.inClassQuizEvalRules = data.evalRules
      break
    case 'classQuestions':
      d.classQuestions = data.questions || []
      break
    case 'practiceTasks':
      d.practiceTasks = data.tasks || []
      break
    case 'homeworks':
      d.homeworkEvalMethods = data.evalMethods || []
      d.homeworkEvalRules = data.evalRules
      d.homeworks = data.items || []
      break
    case 'extensionMaterials':
      d.extensionMaterials = data.resources || []
      break
    case 'trainingReports':
      d.trainingReports = data.reports || []
      break
  }
  return d
}
