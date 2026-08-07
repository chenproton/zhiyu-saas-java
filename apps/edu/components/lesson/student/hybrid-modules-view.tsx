'use client'

import React from 'react'
import Link from 'next/link'
import {
  BookOpen,
  FileText,
  ClipboardList,
  FolderOpen,
  MessageCircleQuestion,
  PenTool,
  MonitorPlay,
  Lightbulb,
  FileCheck2,
  ListChecks,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EVAL_METHOD_LABELS } from '@/lib/types'
import { evalRuleConfigToMethods, type EvalRuleConfig } from '@/lib/types/evaluation'
import type { HybridNodeModule } from '@zhiyu/api-client'
import type { NodeEvaluationResult } from '@zhiyu/api-client'
import type { SystemCourseNode } from '@/lib/types/lesson-source'
import {
  EvalMethodCard,
  EvalMethodResultModel,
  EvalMethodViewModel,
} from '@/components/shared/eval-method-card'
import {
  ResourcePreviewModal,
  usePreviewResources,
} from '@/components/shared/resource-preview-modal'
import type { TaskResource } from '@/lib/types'

export const HYBRID_EVAL_MODULE_KEYS = ['preQuizzes', 'inClassQuizzes', 'homeworks'] as const
export const HYBRID_EVAL_MODULE_LABELS: Record<string, string> = {
  preQuizzes: '课前测验',
  inClassQuizzes: '随堂测验',
  homeworks: '课后作业',
}

const MODULE_LABELS: Record<string, string> = {
  prePreview: '课前预习',
  preResources: '学习资源',
  preTasks: '课前任务',
  preQuizzes: '课前测验',
  lecture: '课堂讲授',
  inClassTasks: '课堂任务',
  inClassQuizzes: '随堂测验',
  classQuestions: '课堂提问',
  practiceTasks: '实践任务',
  homeworks: '课后作业',
  extensionMaterials: '拓展资料',
  trainingReports: '实训报告',
}

// 教学活动模块展示顺序（与编辑端原子模块注册顺序一致）
const ACTIVITY_ORDER: string[] = [
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

const MODULE_ICONS: Record<string, React.ElementType> = {
  prePreview: BookOpen,
  preResources: FolderOpen,
  preTasks: ClipboardList,
  preQuizzes: ListChecks,
  lecture: MonitorPlay,
  inClassTasks: ClipboardList,
  inClassQuizzes: ListChecks,
  classQuestions: MessageCircleQuestion,
  practiceTasks: PenTool,
  homeworks: FileText,
  extensionMaterials: FolderOpen,
  trainingReports: FileCheck2,
}

function AttachmentList({
  items,
  onPreview,
}: {
  items?: { name?: string; file?: string }[]
  onPreview: (url: string, name: string) => void
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((att, i) =>
        att.file ? (
          <button
            key={i}
            type="button"
            onClick={() => onPreview(att.file!, att.name || '附件')}
            className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            {att.name || '附件'}
          </button>
        ) : (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {att.name || '附件'}
          </Badge>
        ),
      )}
    </div>
  )
}

function ResourceList({
  items,
  onPreview,
}: {
  items?: { name?: string; url?: string; type?: string }[]
  onPreview: (url: string, name: string, type?: string) => void
}) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((r, i) =>
        r.url ? (
          <button
            key={i}
            type="button"
            onClick={() => onPreview(r.url!, r.name || '资源', r.type)}
            className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {r.name || '资源'}
            {r.type ? <span className="text-gray-400">({r.type})</span> : null}
          </button>
        ) : (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {r.name || '资源'}
          </Badge>
        ),
      )}
    </div>
  )
}

function TaskList({ items }: { items?: { name?: string; requirement?: string }[] }) {
  if (!items || items.length === 0) return null
  return (
    <div className="space-y-3 mt-3">
      {items.map((task, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
          <div className="text-sm font-medium text-gray-800">{task.name || `任务 ${i + 1}`}</div>
          {task.requirement && (
            <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">
              {task.requirement}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function EvalModuleCards({
  moduleKey,
  label,
  data,
  courseId,
  nodeId,
  myResults,
  submittedKeys,
  onEvalAction,
}: {
  moduleKey: string
  label: string
  data: Record<string, any>
  courseId: string
  nodeId: string
  myResults: NodeEvaluationResult[]
  submittedKeys: Set<string>
  onEvalAction: (moduleKey: string, method: EvalMethodViewModel) => void
}) {
  const ruleConfig = (data?.evalRules || {}) as EvalRuleConfig
  let methods: any[] = []
  try {
    methods = evalRuleConfigToMethods(ruleConfig).filter((m) => m.isEnabled !== false)
  } catch {
    methods = []
  }
  if (methods.length === 0) return null

  const getExamHref = (m: any) => {
    const isExamMethod = ['paper', 'question_bank', 'quiz'].includes(m.methodKey)
    if (!isExamMethod) return undefined
    const examId = m.methodKey === 'paper' ? m.resourceConfig?.paperId : m.resourceConfig?.examId
    const usageId = m.resourceConfig?.usageId
    if (!examId) return undefined
    return `/evaluation/landing/exams/${examId}?node=${nodeId}&method=${moduleKey}:${m.methodKey}&usage=${usageId || ''}&course=${courseId}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
          <ListChecks className="h-4 w-4" />
        </div>
        <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {methods.map((m) => {
          const compositeKey = `${moduleKey}:${m.methodKey}`
          const result = myResults.find((r) => r.methodKey === compositeKey)
          const overriddenResult: EvalMethodResultModel | undefined = submittedKeys.has(
            compositeKey,
          )
            ? { status: 'pending' }
            : result
              ? { status: result.status, totalScore: result.totalScore, maxScore: result.maxScore }
              : undefined
          return (
            <EvalMethodCard
              key={compositeKey}
              method={{
                methodKey: m.methodKey,
                label: `${label} · ${EVAL_METHOD_LABELS[m.methodKey] || m.methodKey}`,
                weight: m.weight,
                resourceConfig: m.resourceConfig,
                reviewSteps: m.reviewSteps,
                evalPoints: m.evalPoints,
              }}
              result={overriddenResult}
              examHref={getExamHref(m)}
              onAction={() =>
                onEvalAction(moduleKey, {
                  methodKey: m.methodKey,
                  weight: m.weight,
                  resourceConfig: m.resourceConfig,
                  reviewSteps: m.reviewSteps,
                  evalPoints: m.evalPoints,
                })
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function renderModuleContent(
  m: HybridNodeModule,
  courseId: string,
  nodeId: string,
  myResults: NodeEvaluationResult[],
  submittedKeys: Set<string>,
  onEvalAction: (moduleKey: string, method: EvalMethodViewModel) => void,
  onPreview: (url: string, name: string, type?: string) => void,
) {
  const data = m.data || {}
  const label = HYBRID_EVAL_MODULE_LABELS[m.moduleKey]
  if (label) {
    return (
      <EvalModuleCards
        moduleKey={m.moduleKey}
        label={label}
        data={data}
        courseId={courseId}
        nodeId={nodeId}
        myResults={myResults}
        submittedKeys={submittedKeys}
        onEvalAction={onEvalAction}
      />
    )
  }
  return (
    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
      {m.moduleKey === 'prePreview' && (
        <>
          {data.content && <p>{data.content}</p>}
          <AttachmentList items={data.attachments} onPreview={onPreview} />
        </>
      )}
      {m.moduleKey === 'preResources' && (
        <ResourceList items={data.resources} onPreview={onPreview} />
      )}
      {m.moduleKey === 'preTasks' && <TaskList items={data.tasks} />}
      {m.moduleKey === 'lecture' && (
        <>
          {data.content && <p>{data.content}</p>}
          {data.sections?.map((s: any, i: number) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 mt-3">
              <div className="text-sm font-medium text-gray-800">
                {s.name || `环节 ${i + 1}`}
              </div>
              {s.content && (
                <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line leading-relaxed">
                  {s.content}
                </p>
              )}
              <AttachmentList items={s.attachments} onPreview={onPreview} />
            </div>
          ))}
          <ResourceList items={data.resources} onPreview={onPreview} />
        </>
      )}
      {m.moduleKey === 'inClassTasks' && <TaskList items={data.tasks} />}
      {m.moduleKey === 'classQuestions' && (
        <div className="space-y-3">
          {data.questions?.map((q: any, i: number) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
              <div className="text-sm text-gray-800 flex items-start gap-2">
                <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{q.stem}</span>
              </div>
              {q.answer && (
                <p className="text-xs text-gray-500 mt-1.5 pl-6">参考答案：{q.answer}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {m.moduleKey === 'practiceTasks' && <TaskList items={data.tasks} />}
      {m.moduleKey === 'extensionMaterials' && (
        <ResourceList items={data.resources} onPreview={onPreview} />
      )}
      {m.moduleKey === 'trainingReports' && (
        <div className="space-y-3">
          {data.reports?.map((r: any, i: number) => (
            <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-gray-800">
                  {r.name || `报告 ${i + 1}`}
                </span>
                {r.required && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    必修
                  </Badge>
                )}
              </div>
              {r.template && (
                <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">{r.template}</p>
              )}
              {r.requirement && (
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{r.requirement}</p>
              )}
              <AttachmentList items={r.attachments} onPreview={onPreview} />
            </div>
          ))}
        </div>
      )}
      {m.moduleKey === 'homeworks' && data.items?.length > 0 && (
        <TaskList
          items={data.items.map((h: any) => ({ name: '作业要求', requirement: h.requirement }))}
        />
      )}
    </div>
  )
}

interface HybridModulesViewProps {
  node: SystemCourseNode
  modules: HybridNodeModule[]
  courseId: string
  myResults: NodeEvaluationResult[]
  submittedKeys: Set<string>
  onEvalAction: (moduleKey: string, method: EvalMethodViewModel) => void
}

export function HybridModulesView({
  node,
  modules,
  courseId,
  myResults,
  submittedKeys,
  onEvalAction,
}: HybridModulesViewProps) {
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const designModule = modules.find((m) => m.moduleKey === 'teachingDesign')
  const reviewModule = modules.find((m) => m.moduleKey === 'postLessonReview')
  const activityModules = modules
    .filter((m) => ACTIVITY_ORDER.includes(m.moduleKey))
    .sort((a, b) => ACTIVITY_ORDER.indexOf(a.moduleKey) - ACTIVITY_ORDER.indexOf(b.moduleKey))

  const handlePreview = (url: string, name: string, type?: string) => {
    addPreviewResource({
      id: `attachment-${url}`,
      name,
      url,
      type: type || 'file',
    } as TaskResource)
  }

  return (
    <div className="space-y-5">
      {/* 教学设计 */}
      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden py-0 gap-0 bg-white">
        <CardHeader className="border-b border-gray-100 px-6 py-5 bg-white">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">教学设计</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 bg-white">
          {designModule?.data?.content ? (
            <div className="text-sm text-gray-700 whitespace-pre-line leading-loose">
              {designModule.data.content}
            </div>
          ) : (
            <p className="text-xs text-gray-400">暂无教学设计</p>
          )}
        </CardContent>
      </Card>

      {/* 教学过程 */}
      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden py-0 gap-0 bg-white">
        <CardHeader className="border-b border-gray-100 px-6 py-5 bg-white">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
              <MonitorPlay className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">教学过程</span>
            {activityModules.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-[11px] font-normal">
                {activityModules.length} 个教学活动
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 bg-white">
          {activityModules.length === 0 ? (
            <p className="text-xs text-gray-400">该节点暂无教学活动</p>
          ) : (
            <div className="space-y-6">
              {activityModules.map((m) => (
                <div key={m.moduleKey} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                    {(() => {
                      const Icon = MODULE_ICONS[m.moduleKey] || Lightbulb
                      return <Icon className="h-4 w-4" />
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        {MODULE_LABELS[m.moduleKey] || m.moduleKey}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium text-gray-500">
                        {m.mode === 'online' ? '线上' : '线下'}
                      </span>
                    </div>
                    <div className="mt-2">
                      {renderModuleContent(
                        m,
                        courseId,
                        node.id,
                        myResults,
                        submittedKeys,
                        onEvalAction,
                        handlePreview,
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 课后复盘 */}
      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden py-0 gap-0 bg-white">
        <CardHeader className="border-b border-gray-100 px-6 py-5 bg-white">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500">
              <ClipboardList className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">课后复盘</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 bg-white">
          {reviewModule?.data?.content ? (
            <div className="text-sm text-gray-700 whitespace-pre-line leading-loose">
              {reviewModule.data.content}
            </div>
          ) : (
            <p className="text-xs text-gray-400">暂无课后复盘</p>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/lesson/landing/${courseId}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        返回课程详情
      </Link>

      {previewResources.map((r, i) => (
        <ResourcePreviewModal
          key={r.id}
          resource={r}
          open
          index={i}
          backdrop={false}
          onOpenChange={() => removePreviewResource(r.id)}
        />
      ))}
    </div>
  )
}
