'use client'

import React, { useMemo, useState } from 'react'
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
  Sun,
  Moon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/locale-provider'

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

// 教学过程三阶段：课前 / 课中 / 课后
const PHASES: {
  key: string
  label: string
  icon: React.ElementType
  iconClass: string
  activeClass: string
  keys: string[]
}[] = [
  {
    key: 'pre',
    label: '课前',
    icon: Sun,
    iconClass: 'bg-sky-50 text-sky-600 border-sky-100',
    activeClass: 'data-[state=active]:text-sky-600 data-[state=active]:bg-sky-50',
    keys: ['prePreview', 'preResources', 'preTasks', 'preQuizzes'],
  },
  {
    key: 'in',
    label: '课中',
    icon: MonitorPlay,
    iconClass: 'bg-violet-50 text-violet-600 border-violet-100',
    activeClass: 'data-[state=active]:text-violet-600 data-[state=active]:bg-violet-50',
    keys: ['lecture', 'inClassTasks', 'inClassQuizzes', 'classQuestions'],
  },
  {
    key: 'post',
    label: '课后',
    icon: Moon,
    iconClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    activeClass: 'data-[state=active]:text-emerald-600 data-[state=active]:bg-emerald-50',
    keys: ['practiceTasks', 'homeworks', 'extensionMaterials', 'trainingReports'],
  },
]

// 模块图标气泡配色
const MODULE_ICON_CLASSES: Record<string, string> = {
  prePreview: 'bg-sky-50 text-sky-600 border-sky-100',
  preResources: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  preTasks: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  preQuizzes: 'bg-blue-50 text-blue-600 border-blue-100',
  lecture: 'bg-violet-50 text-violet-600 border-violet-100',
  inClassTasks: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  inClassQuizzes: 'bg-purple-50 text-purple-600 border-purple-100',
  classQuestions: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
  practiceTasks: 'bg-amber-50 text-amber-600 border-amber-100',
  homeworks: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  extensionMaterials: 'bg-teal-50 text-teal-600 border-teal-100',
  trainingReports: 'bg-orange-50 text-orange-600 border-orange-100',
}

function AttachmentList({
  items,
  onPreview,
}: {
  items?: { name?: string; file?: string }[]
  onPreview: (url: string, name: string) => void
}) {
  const t = useT()
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((att, i) =>
        att.file ? (
          <button
            key={i}
            type="button"
            onClick={() => onPreview(att.file!, att.name || t('附件'))}
            className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            {att.name || t('附件')}
          </button>
        ) : (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {att.name || t('附件')}
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
  const t = useT()
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((r, i) =>
        r.url ? (
          <button
            key={i}
            type="button"
            onClick={() => onPreview(r.url!, r.name || t('资源'), r.type)}
            className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {r.name || t('资源')}
            {r.type ? <span className="text-gray-400">({r.type})</span> : null}
          </button>
        ) : (
          <Badge key={i} variant="secondary" className="text-xs font-normal">
            {r.name || t('资源')}
          </Badge>
        ),
      )}
    </div>
  )
}

function TaskList({ items }: { items?: { name?: string; requirement?: string }[] }) {
  const t = useT()
  if (!items || items.length === 0) return null
  return (
    <div className="space-y-3 mt-3">
      {items.map((task, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
          <div className="text-sm font-medium text-gray-800">
            {task.name || t('任务 {n}', { n: i + 1 })}
          </div>
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
  const t = useT()
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
        <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
          <ListChecks className="h-4 w-4" />
        </div>
        <h4 className="text-sm font-semibold text-gray-800">{t(label)}</h4>
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
                label: `${t(label)} · ${t(EVAL_METHOD_LABELS[m.methodKey]) || m.methodKey}`,
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
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const data = m.data || {}
  const label = HYBRID_EVAL_MODULE_LABELS[m.moduleKey]
  if (label) {
    return (
      <EvalModuleCards
        moduleKey={m.moduleKey}
        label={t(label)}
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
                {s.name || t('环节 {n}', { n: i + 1 })}
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
                <p className="text-xs text-gray-500 mt-1.5 pl-6">
                  {t('参考答案：{n}', { n: q.answer })}
                </p>
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
                  {r.name || t('报告 {n}', { n: i + 1 })}
                </span>
                {r.required && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {t('必修')}
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
          items={data.items.map((h: any) => ({ name: t('作业要求'), requirement: h.requirement }))}
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
  const t = useT()
  const [previewResources, addPreviewResource, removePreviewResource] = usePreviewResources()
  const designModule = modules.find((m) => m.moduleKey === 'teachingDesign')
  const reviewModule = modules.find((m) => m.moduleKey === 'postLessonReview')
  const activityModules = modules
    .filter((m) => ACTIVITY_ORDER.includes(m.moduleKey))
    .sort((a, b) => ACTIVITY_ORDER.indexOf(a.moduleKey) - ACTIVITY_ORDER.indexOf(b.moduleKey))

  // 教学过程按课前/课中/课后分组
  const [activePhase, setActivePhase] = useState('pre')
  const phaseModules = useMemo(() => {
    const map = new Map<string, HybridNodeModule[]>()
    for (const p of PHASES) {
      map.set(p.key, activityModules.filter((m) => p.keys.includes(m.moduleKey)))
    }
    return map
  }, [activityModules])

  // 当前阶段无内容时回退到第一个有内容的阶段（数据异步加载完成前选中课前）
  const effectivePhase =
    (phaseModules.get(activePhase) || []).length > 0
      ? activePhase
      : (PHASES.find((p) => (phaseModules.get(p.key) || []).length > 0)?.key ?? 'pre')

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">{t('教学设计')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 bg-white">
          {designModule?.data?.content ? (
            <div className="text-sm text-gray-700 whitespace-pre-line leading-loose">
              {designModule.data.content}
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t('暂无教学设计')}</p>
          )}
        </CardContent>
      </Card>

      {/* 教学过程：课前/课中/课后三阶段 */}
      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden py-0 gap-0 bg-white">
        <CardHeader className="border-b border-gray-100 px-6 py-5 bg-white">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <MonitorPlay className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">{t('教学过程')}</span>
            {activityModules.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-[11px] font-normal">
                {t('{n} 个教学活动', { n: activityModules.length })}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 bg-white">
          {activityModules.length === 0 ? (
            <p className="text-xs text-gray-400">{t('该节点暂无教学活动')}</p>
          ) : (
            <Tabs value={effectivePhase} onValueChange={setActivePhase}>
              <TabsList className="flex w-full h-auto bg-gray-100/80 rounded-xl p-1 gap-1">
                {PHASES.map((p) => {
                  const Icon = p.icon
                  const count = (phaseModules.get(p.key) || []).length
                  return (
                    <TabsTrigger
                      key={p.key}
                      value={p.key}
                      className={cn(
                        'flex-1 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-500 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all',
                        p.activeClass,
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(p.label)}</span>
                      {count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold shrink-0">
                          {count}
                        </span>
                      )}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
              {PHASES.map((p) => {
                const modules = phaseModules.get(p.key) || []
                const PhaseIcon = p.icon
                return (
                  <TabsContent key={p.key} value={p.key} className="mt-5 space-y-5">
                    {modules.length > 0 ? (
                      modules.map((m) => (
                        <div key={m.moduleKey} className="flex items-start gap-3">
                          <div
                            className={cn(
                              'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0',
                              MODULE_ICON_CLASSES[m.moduleKey] ||
                                'bg-gray-50 text-gray-500 border-gray-200',
                            )}
                          >
                            {(() => {
                              const Icon = MODULE_ICONS[m.moduleKey] || Lightbulb
                              return <Icon className="h-4 w-4" />
                            })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-gray-800">
                                {t(MODULE_LABELS[m.moduleKey] || m.moduleKey)}
                              </span>
                              <span
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                                  m.mode === 'online'
                                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                                    : 'bg-amber-50 text-amber-600 border-amber-100',
                                )}
                              >
                                {m.mode === 'online' ? t('线上') : t('线下')}
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
                                t,
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center gap-3 py-10">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-2xl border flex items-center justify-center',
                            p.iconClass,
                          )}
                        >
                          <PhaseIcon className="h-5 w-5" />
                        </div>
                        <p className="text-xs text-gray-400">{t('该阶段暂无教学活动')}</p>
                      </div>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* 课后复盘 */}
      <Card className="rounded-2xl border border-gray-200 shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden py-0 gap-0 bg-white">
        <CardHeader className="border-b border-gray-100 px-6 py-5 bg-white">
          <CardTitle className="text-base flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white shadow-md shadow-primary/20">
              <ClipboardList className="h-4 w-4" />
            </div>
            <span className="text-gray-800 font-semibold text-lg">{t('课后复盘')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-8 bg-white">
          {reviewModule?.data?.content ? (
            <div className="text-sm text-gray-700 whitespace-pre-line leading-loose">
              {reviewModule.data.content}
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t('暂无课后复盘')}</p>
          )}
        </CardContent>
      </Card>

      <Link
        href={`/lesson/landing/${courseId}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {t('返回课程详情')}
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
