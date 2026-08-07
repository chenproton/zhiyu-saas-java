'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  MonitorPlay,
  FileText,
  ClipboardList,
  Plus,
  Trash2,
  Upload,
  Database,
  HelpCircle,
  CheckCircle2,
  MessageCircleQuestion,
  Wrench,
  FolderOpen,
  Award,
  Loader2,
} from 'lucide-react'
import { CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from '@zhiyu/ui'
import { fileApi, resourceLibraryApi } from '@/lib/api'
import { ResourceSelector } from '@/components/shared/resource-selector'
import { EvaluationMethodSelector } from '../../../_components/assessment/evaluation-method-selector'
import { CourseEvaluationRulesDialog } from '@/components/lesson/course-evaluation-rules-dialog'
import type { EvalRuleConfig } from '@/lib/types/evaluation'
import { useT } from '@/lib/i18n/locale-provider'

// ==================== Types ====================

export const COURSE_CATEGORIES = [
  '公共基础必修课程',
  '公共基础限选课程',
  '公共基础任选课程',
  '专业基础课程',
  '专业核心课程',
  '专业拓展课程',
] as const
export type CourseCategory = (typeof COURSE_CATEGORIES)[number]

export interface CourseBasicForm {
  name: string
  code: string
  majorId: string
  majorName: string
  semester: string
  category: CourseCategory
  courseObjectives: string
  detailedDescription: string
  background: string
  estimatedHours: string
  coverImage: string
}

export interface AttachmentItem {
  id: string
  name: string
  file: string
}

export interface LectureSectionItem {
  id: string
  name: string
  content: string
  attachments: AttachmentItem[]
}

export interface TaskItem {
  id: string
  name: string
  requirement: string
  attachments: AttachmentItem[]
  source?: 'manual' | 'scenario'
  scenarioId?: string
  scenarioTitle?: string
}

export interface QuestionOption {
  id: string
  label: string
  isCorrect: boolean
}

export interface QuizQuestion {
  id: string
  type: 'single' | 'multiple' | 'judge' | 'essay'
  stem: string
  options: QuestionOption[]
  answer: string
}

export interface QuizItem {
  id: string
  name: string
  questions: QuizQuestion[]
}

export interface ClassroomQuestion {
  id: string
  stem: string
  answer: string
  source?: 'manual' | 'bank'
  bankId?: string
  bankTitle?: string
}

export interface HomeworkItem {
  id: string
  requirement: string
  allowText: boolean
  allowAttachment: boolean
  deadline: string
}

export interface ResourceItem {
  id: string
  name: string
  type: string
  source?: string
  url?: string
  description?: string
  thumbnail?: string
}

export interface ReportItem {
  id: string
  name: string
  template: string
  requirement: string
  required: boolean
  attachments: AttachmentItem[]
}

export interface NodeModuleData {
  form: CourseBasicForm
  teachingDesignContent: string
  postLessonReviewContent: string
  teachingDesignGroups: { id: string; name: string }[]
  moduleModes: Partial<Record<AtomicModuleKey, 'online' | 'offline'>>
  previewContent: string
  previewAttachments: AttachmentItem[]
  preClassResources: ResourceItem[]
  preClassTasks: TaskItem[]
  preClassQuizzes: QuizItem[]
  preQuizEvalMethods: string[]
  preQuizEvalRules?: EvalRuleConfig
  lectureContent: string
  lectureResources: ResourceItem[]
  lectureSections: LectureSectionItem[]
  inClassTasks: TaskItem[]
  inClassQuizzes: QuizItem[]
  inClassQuizEvalMethods: string[]
  inClassQuizEvalRules?: EvalRuleConfig
  classQuestions: ClassroomQuestion[]
  practiceTasks: TaskItem[]
  homeworks: HomeworkItem[]
  homeworkEvalMethods: string[]
  homeworkEvalRules?: EvalRuleConfig
  extensionMaterials: ResourceItem[]
  trainingReports: ReportItem[]
}

export type AtomicModuleCategory = 'pre-class' | 'in-class' | 'post-class'

export type AtomicModuleKey =
  | 'prePreview'
  | 'preResources'
  | 'preTasks'
  | 'preQuizzes'
  | 'lecture'
  | 'inClassTasks'
  | 'inClassQuizzes'
  | 'classQuestions'
  | 'practiceTasks'
  | 'homeworks'
  | 'extensionMaterials'
  | 'trainingReports'

export interface AtomicModuleMeta {
  key: AtomicModuleKey
  label: string
  category: AtomicModuleCategory
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<AtomicModuleProps>
}

export interface AtomicModuleProps {
  nodeId: string
  data: NodeModuleData
  onChange: (patch: Partial<NodeModuleData>) => void
  courseId?: string
}

// ==================== Default data ====================

export function createDefaultNodeModuleData(existing?: {
  name?: string
  code?: string
  majorId?: string
  majorName?: string
  semester?: string
  category?: CourseCategory
  coverImage?: string
}): NodeModuleData {
  const incomingCategory = existing?.category
  const category: CourseCategory =
    incomingCategory && COURSE_CATEGORIES.includes(incomingCategory)
      ? incomingCategory
      : '专业核心课程'
  const ts = Date.now().toString()
  return {
    form: {
      name: existing?.name ?? '',
      code: existing?.code ?? `HYB-${ts.slice(-6)}`,
      majorId: existing?.majorId ?? '',
      majorName: existing?.majorName ?? '',
      semester: existing?.semester ?? '2026-2027-1',
      category,
      courseObjectives: '',
      detailedDescription: '',
      background: '',
      estimatedHours: '',
      coverImage: '',
    },
    teachingDesignContent: `● 知识目标
● 能力目标
● 素质目标
● 教学重点
● 教学难点
● 教学方法
● 考核方式`,
    postLessonReviewContent: '请输入课后总结内容',
    teachingDesignGroups: [],
    moduleModes: {},
    previewContent: '',
    previewAttachments: [],
    preClassResources: [],
    preClassTasks: [],
    preClassQuizzes: [],
    preQuizEvalMethods: [],
    lectureContent: '',
    lectureResources: [],
    lectureSections: [],
    inClassTasks: [],
    inClassQuizzes: [],
    inClassQuizEvalMethods: [],
    classQuestions: [],
    practiceTasks: [],
    homeworks: [],
    homeworkEvalMethods: [],
    extensionMaterials: [],
    trainingReports: [],
  }
}

// ==================== Shared helpers ====================

function MockRichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="border rounded-md text-sm min-h-[80px] resize-y"
    />
  )
}

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ==================== Attachment editor ====================

function AttachmentListEditor({
  items,
  onChange,
  addLabel,
}: {
  items: AttachmentItem[]
  onChange: (items: AttachmentItem[]) => void
  addLabel?: string
}) {
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const pendingItemIdRef = React.useRef<string | null>(null)
  const t = useT()

  const update = (idx: number, patch: Partial<AttachmentItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const itemId = pendingItemIdRef.current
    e.target.value = ''
    if (!file || !itemId) return
    setUploadingId(itemId)
    try {
      const res = await fileApi.upload(file)
      const idx = items.findIndex((it) => it.id === itemId)
      if (idx >= 0) {
        update(idx, { name: file.name, file: res.url })
      }
      toast({ title: t('附件上传成功') })
    } catch (err: any) {
      toast({ title: err?.message || t('附件上传失败'), variant: 'destructive' })
    } finally {
      setUploadingId(null)
      pendingItemIdRef.current = null
    }
  }

  const triggerUpload = (itemId: string) => {
    pendingItemIdRef.current = itemId
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 border rounded-lg p-3 bg-gray-50/50">
          <Input
            value={item.name}
            onChange={(e) => update(idx, { name: e.target.value })}
            placeholder={t('附件名称')}
            className="h-9 text-sm bg-white"
          />
          <div className="flex items-center gap-2 shrink-0">
            {item.file ? (
              <Badge variant="secondary" className="font-normal text-xs max-w-[160px] truncate">
                {item.file.split('/').pop()}
              </Badge>
            ) : (
              <span className="text-xs text-gray-400 whitespace-nowrap">{t('未选择资料')}</span>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={uploadingId === item.id}
              onClick={() => triggerUpload(item.id)}
            >
              {uploadingId === item.id ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 mr-1" />
              )}
              {uploadingId === item.id ? t('上传中') : t('选择资料')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-400 hover:text-red-500"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...items, { id: uid('att'), name: '', file: '' }])}
      >
        <Plus className="h-4 w-4 mr-1" />
        {addLabel}
      </Button>
    </div>
  )
}

// ==================== Task editor ====================

function TaskListEditor({
  items,
  onChange,
  addLabel,
}: {
  items: TaskItem[]
  onChange: (items: TaskItem[]) => void
  addLabel?: string
}) {
  const update = (idx: number, patch: Partial<TaskItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const t = useT()

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={item.id} className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={item.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder={t('任务名称')}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          <MockRichEditor
            value={item.requirement}
            onChange={(v) => update(idx, { requirement: v })}
            placeholder={t('任务要求')}
          />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('任务附件')}</Label>
            <AttachmentListEditor
              items={item.attachments}
              onChange={(attachments) => update(idx, { attachments })}
              addLabel={t('上传附件')}
            />
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...items,
            { id: uid('task'), name: '', requirement: '', attachments: [], source: 'manual' },
          ])
        }
      >
        <Plus className="h-4 w-4 mr-1" />
        {addLabel ?? t('添加任务')}
      </Button>
    </div>
  )
}

// ==================== Report editor ====================

function ReportListEditor({
  items,
  onChange,
}: {
  items: ReportItem[]
  onChange: (items: ReportItem[]) => void
}) {
  const update = (idx: number, patch: Partial<ReportItem>) => {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }
  const t = useT()

  return (
    <div className="space-y-4">
      {items.map((item, idx) => (
        <div key={item.id} className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Input
              value={item.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder={t('报告名称')}
            />
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id={`report-req-${item.id}`}
                checked={item.required}
                onCheckedChange={(checked) => update(idx, { required: checked })}
              />
              <Label htmlFor={`report-req-${item.id}`} className="text-sm whitespace-nowrap">
                {t('必修')}
              </Label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          <MockRichEditor
            value={item.template}
            onChange={(v) => update(idx, { template: v })}
            placeholder={t('报告模板')}
          />
          <MockRichEditor
            value={item.requirement}
            onChange={(v) => update(idx, { requirement: v })}
            placeholder={t('报告要求')}
          />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('报告附件')}</Label>
            <AttachmentListEditor
              items={item.attachments || []}
              onChange={(attachments) => update(idx, { attachments })}
              addLabel={t('上传附件')}
            />
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange([
            ...items,
            {
              id: uid('report'),
              name: '',
              template: '',
              requirement: '',
              required: true,
              attachments: [],
            },
          ])
        }
      >
        <Plus className="h-4 w-4 mr-1" />
        {t('添加报告')}
      </Button>
    </div>
  )
}

// ==================== Activity module wrappers ====================

function PrePreviewModule({ data, onChange }: AtomicModuleProps) {
  const t = useT()
  return (
    <CardContent className="space-y-4">
      <MockRichEditor
        value={data.previewContent}
        onChange={(v) => onChange({ previewContent: v })}
        placeholder={t('请输入课前预习内容')}
      />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t('预习资料附件')}</Label>
        <AttachmentListEditor
          items={data.previewAttachments}
          onChange={(v) => onChange({ previewAttachments: v })}
          addLabel={t('添加附件')}
        />
      </div>
    </CardContent>
  )
}

// 教学活动模块的资源选择统一复用公共 ResourceSelector（与体系课/颗粒课/场景任务一致）
function ResourceModuleEditor({
  items,
  onChange,
  courseId,
}: {
  items: ResourceItem[]
  onChange: (items: ResourceItem[]) => void
  courseId?: string
}) {
  const [pool, setPool] = useState<ResourceItem[]>([])

  useEffect(() => {
    let cancelled = false
    resourceLibraryApi
      .list({ limit: 1000 })
      .then((res) => {
        if (cancelled) return
        setPool(
          (res.items || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.resourceType || r.type || 'other',
            url: r.url,
            description: r.description,
            thumbnail: r.thumbnail,
            source: r.url || '',
          })),
        )
      })
      .catch(() => {
        /* 资源库加载失败时保持空池 */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (ids: string[]) => {
    const selected = ids
      .map((id) => pool.find((p) => p.id === id))
      .filter(Boolean) as ResourceItem[]
    onChange(selected)
  }

  return (
    <ResourceSelector
      pool={pool}
      selectedIds={items.map((i) => i.id)}
      onChange={handleChange}
      onUpload={(r) => setPool((prev) => [r, ...prev])}
      courseId={courseId}
    />
  )
}

function PreResourcesModule({ data, onChange, courseId }: AtomicModuleProps) {
  return (
    <CardContent>
      <ResourceModuleEditor
        items={data.preClassResources}
        onChange={(v) => onChange({ preClassResources: v })}
        courseId={courseId}
      />
    </CardContent>
  )
}

function PreTasksModule({ data, onChange }: AtomicModuleProps) {
  const t = useT()
  return (
    <CardContent>
      <TaskListEditor
        items={data.preClassTasks}
        onChange={(v) => onChange({ preClassTasks: v })}
        addLabel={t('添加课前任务')}
      />
    </CardContent>
  )
}

function PreQuizzesModule({ data, onChange }: AtomicModuleProps) {
  const methods = data.preQuizEvalMethods
  const t = useT()
  return (
    <CardContent className="space-y-4">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程测评方式')}
        </p>
        <EvaluationMethodSelector
          selectedKeys={methods}
          onChange={(keys) => onChange({ preQuizEvalMethods: keys })}
        />
      </div>
      <div className="border-t pt-4">
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程评价规则')}
        </p>
        {methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 py-12">
            <Database className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">{t('尚未配置评价方式')}</p>
            <p className="text-xs mt-1">{t('请先在「配置课程测评方式」中选择评价类型')}</p>
          </div>
        ) : (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={data.preQuizEvalRules}
            onChange={(config) => onChange({ preQuizEvalRules: config })}
            title={t('配置课前测验评价规则')}
          />
        )}
      </div>
    </CardContent>
  )
}

function LectureModule({ data, onChange }: AtomicModuleProps) {
  const sections = data.lectureSections || []
  const t = useT()

  const update = (idx: number, patch: Partial<LectureSectionItem>) => {
    const next = [...sections]
    next[idx] = { ...next[idx], ...patch }
    onChange({ lectureSections: next })
  }

  return (
    <CardContent className="space-y-4">
      {sections.length === 0 && (
        <div className="text-center text-sm text-gray-400 py-4 border border-dashed rounded-lg">
          {t('暂无讲授环节，点击下方按钮新增')}
        </div>
      )}
      {sections.map((section, idx) => (
        <div key={section.id} className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              value={section.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              placeholder={t('环节名称')}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange({ lectureSections: sections.filter((_, i) => i !== idx) })}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          <MockRichEditor
            value={section.content}
            onChange={(v) => update(idx, { content: v })}
            placeholder={t('请输入环节讲授内容')}
          />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t('环节附件')}</Label>
            <AttachmentListEditor
              items={section.attachments}
              onChange={(attachments) => update(idx, { attachments })}
              addLabel={t('上传附件')}
            />
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange({
            lectureSections: [
              ...sections,
              { id: uid('lecture-section'), name: '', content: '', attachments: [] },
            ],
          })
        }
      >
        <Plus className="h-4 w-4 mr-1" />
        {t('新增环节')}
      </Button>
    </CardContent>
  )
}

function InClassTasksModule({ data, onChange }: AtomicModuleProps) {
  const t = useT()
  return (
    <CardContent>
      <TaskListEditor
        items={data.inClassTasks}
        onChange={(v) => onChange({ inClassTasks: v })}
        addLabel={t('添加课堂任务')}
      />
    </CardContent>
  )
}

function InClassQuizzesModule({ data, onChange }: AtomicModuleProps) {
  const methods = data.inClassQuizEvalMethods
  const t = useT()
  return (
    <CardContent className="space-y-4">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程测评方式')}
        </p>
        <EvaluationMethodSelector
          selectedKeys={methods}
          onChange={(keys) => onChange({ inClassQuizEvalMethods: keys })}
        />
      </div>
      <div className="border-t pt-4">
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程评价规则')}
        </p>
        {methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 py-12">
            <Database className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">{t('尚未配置评价方式')}</p>
            <p className="text-xs mt-1">{t('请先在「配置课程测评方式」中选择评价类型')}</p>
          </div>
        ) : (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={data.inClassQuizEvalRules}
            onChange={(config) => onChange({ inClassQuizEvalRules: config })}
            title={t('配置课中测验评价规则')}
          />
        )}
      </div>
    </CardContent>
  )
}

function ClassQuestionsModule({ data, onChange }: AtomicModuleProps) {
  const questions = data.classQuestions || []
  const t = useT()

  const updateQuestion = (idx: number, patch: Partial<ClassroomQuestion>) => {
    const next = [...questions]
    next[idx] = { ...next[idx], ...patch }
    onChange({ classQuestions: next })
  }

  const addQuestion = () => {
    onChange({
      classQuestions: [...questions, { id: uid('q'), stem: '', answer: '', source: 'manual' }],
    })
  }

  return (
    <CardContent className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.id} className="border rounded-lg p-3 space-y-3">
          {q.source === 'bank' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#1890ff]" />
                <div>
                  <p className="text-sm font-medium">{q.bankTitle || q.stem}</p>
                  <p className="text-xs text-gray-400">{t('来自题库')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ classQuestions: questions.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={q.stem}
                  onChange={(e) => updateQuestion(idx, { stem: e.target.value })}
                  placeholder={t('问题内容')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onChange({ classQuestions: questions.filter((_, i) => i !== idx) })
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <Input
                value={q.answer}
                onChange={(e) => updateQuestion(idx, { answer: e.target.value })}
                placeholder={t('参考答案')}
              />
            </>
          )}
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addQuestion}>
        <Plus className="h-4 w-4 mr-1" />
        {t('添加提问')}
      </Button>
    </CardContent>
  )
}

function PracticeTasksModule({ data, onChange }: AtomicModuleProps) {
  const tasks = data.practiceTasks || []
  const t = useT()

  const updateTask = (idx: number, patch: Partial<TaskItem>) => {
    const next = [...tasks]
    next[idx] = { ...next[idx], ...patch }
    onChange({ practiceTasks: next })
  }

  const addTask = () => {
    onChange({
      practiceTasks: [
        ...tasks,
        { id: uid('task'), name: '', requirement: '', attachments: [], source: 'manual' },
      ],
    })
  }

  return (
    <CardContent className="space-y-4">
      {tasks.map((task, idx) => (
        <div key={task.id} className="border rounded-lg p-3 space-y-3">
          {task.source === 'scenario' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#1890ff]" />
                <div>
                  <p className="text-sm font-medium">{task.scenarioTitle || task.name}</p>
                  <p className="text-xs text-gray-400">{t('来自实践场景库')}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ practiceTasks: tasks.filter((_, i) => i !== idx) })}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={task.name}
                  onChange={(e) => updateTask(idx, { name: e.target.value })}
                  placeholder={t('任务名称')}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange({ practiceTasks: tasks.filter((_, i) => i !== idx) })}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <MockRichEditor
                value={task.requirement}
                onChange={(v) => updateTask(idx, { requirement: v })}
                placeholder={t('任务要求')}
              />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t('任务附件')}</Label>
                <AttachmentListEditor
                  items={task.attachments}
                  onChange={(attachments) => updateTask(idx, { attachments })}
                  addLabel={t('上传附件')}
                />
              </div>
            </>
          )}
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addTask}>
        <Plus className="h-4 w-4 mr-1" />
        {t('添加实践任务')}
      </Button>
    </CardContent>
  )
}

function HomeworksModule({ data, onChange }: AtomicModuleProps) {
  const methods = data.homeworkEvalMethods
  const t = useT()
  return (
    <CardContent className="space-y-4">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程测评方式')}
        </p>
        <EvaluationMethodSelector
          selectedKeys={methods}
          onChange={(keys) => onChange({ homeworkEvalMethods: keys })}
        />
      </div>
      <div className="border-t pt-4">
        <p className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-[#1890ff]" />
          {t('配置课程评价规则')}
        </p>
        {methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 py-12">
            <Database className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">{t('尚未配置评价方式')}</p>
            <p className="text-xs mt-1">{t('请先在「配置课程测评方式」中选择评价类型')}</p>
          </div>
        ) : (
          <CourseEvaluationRulesDialog
            inline
            evaluationMethods={methods}
            initialConfig={data.homeworkEvalRules}
            onChange={(config) => onChange({ homeworkEvalRules: config })}
            title={t('配置课后作业评价规则')}
          />
        )}
      </div>
    </CardContent>
  )
}

function ExtensionMaterialsModule({ data, onChange, courseId }: AtomicModuleProps) {
  return (
    <CardContent>
      <ResourceModuleEditor
        items={data.extensionMaterials}
        onChange={(v) => onChange({ extensionMaterials: v })}
        courseId={courseId}
      />
    </CardContent>
  )
}

function TrainingReportsModule({ data, onChange }: AtomicModuleProps) {
  return (
    <CardContent>
      <ReportListEditor
        items={data.trainingReports}
        onChange={(v) => onChange({ trainingReports: v })}
      />
    </CardContent>
  )
}

// ==================== Module registry ====================

const icon = (Ic: React.ComponentType<{ className?: string }>) => Ic

export const ATOMIC_MODULES: AtomicModuleMeta[] = [
  {
    key: 'prePreview',
    label: '课前预习',
    category: 'pre-class',
    icon: icon(BookOpen),
    component: PrePreviewModule,
  },
  {
    key: 'preResources',
    label: '学习资源',
    category: 'pre-class',
    icon: icon(Database),
    component: PreResourcesModule,
  },
  {
    key: 'preTasks',
    label: '课前任务',
    category: 'pre-class',
    icon: icon(ClipboardList),
    component: PreTasksModule,
  },
  {
    key: 'preQuizzes',
    label: '课前测验',
    category: 'pre-class',
    icon: icon(HelpCircle),
    component: PreQuizzesModule,
  },
  {
    key: 'lecture',
    label: '课堂讲授',
    category: 'in-class',
    icon: icon(MonitorPlay),
    component: LectureModule,
  },
  {
    key: 'inClassTasks',
    label: '课堂任务',
    category: 'in-class',
    icon: icon(ClipboardList),
    component: InClassTasksModule,
  },
  {
    key: 'inClassQuizzes',
    label: '随堂测验',
    category: 'in-class',
    icon: icon(CheckCircle2),
    component: InClassQuizzesModule,
  },
  {
    key: 'classQuestions',
    label: '课堂提问',
    category: 'in-class',
    icon: icon(MessageCircleQuestion),
    component: ClassQuestionsModule,
  },
  {
    key: 'practiceTasks',
    label: '实践任务',
    category: 'in-class',
    icon: icon(Wrench),
    component: PracticeTasksModule,
  },
  {
    key: 'homeworks',
    label: '课后作业',
    category: 'post-class',
    icon: icon(FileText),
    component: HomeworksModule,
  },
  {
    key: 'extensionMaterials',
    label: '拓展资料',
    category: 'post-class',
    icon: icon(FolderOpen),
    component: ExtensionMaterialsModule,
  },
  {
    key: 'trainingReports',
    label: '实训报告',
    category: 'post-class',
    icon: icon(FileText),
    component: TrainingReportsModule,
  },
]

export const ATOMIC_MODULES_BY_KEY = Object.fromEntries(
  ATOMIC_MODULES.map((m) => [m.key, m]),
) as Record<AtomicModuleKey, AtomicModuleMeta>

export const DEFAULT_MODULES: AtomicModuleKey[] = []

export const CATEGORY_LABELS: Record<AtomicModuleCategory, string> = {
  'pre-class': '课前准备',
  'in-class': '教学实施',
  'post-class': '课后拓展',
}
