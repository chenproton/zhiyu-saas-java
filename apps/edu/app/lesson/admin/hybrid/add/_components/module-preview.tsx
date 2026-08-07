'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVALUATION_METHOD_OPTIONS } from '@/components/shared/eval-method-selector'
import { ATOMIC_MODULES_BY_KEY, type AtomicModuleKey, type NodeModuleData } from './atomic-modules'
import { useT } from '@/lib/i18n/locale-provider'

// ==================== 摘要生成（参考 scene/scenarios/.../edit/tasks 卡片摘要模式） ====================

const methodLabel = (key: string) =>
  EVALUATION_METHOD_OPTIONS.find((o) => o.key === key)?.label || key

function truncate(text: string, max = 60) {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function listSummary(
  items: { name?: string; stem?: string; bankTitle?: string; requirement?: string }[],
  countLabel: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (items.length === 0) return ''
  const lines = items
    .slice(0, 5)
    .map(
      (it) => `· ${truncate(it.name || it.bankTitle || it.stem || it.requirement || t('未填写'), 40)}`,
    )
    .join('\n')
  return items.length > 5
    ? t('…共 {n} {count}', { n: items.length, count: t(countLabel) })
    : lines
}

export function isModuleConfigured(key: AtomicModuleKey, data: NodeModuleData): boolean {
  switch (key) {
    case 'prePreview':
      return !!data.previewContent.trim() || data.previewAttachments.length > 0
    case 'preResources':
      return data.preClassResources.length > 0
    case 'preTasks':
      return data.preClassTasks.length > 0
    case 'preQuizzes':
      return data.preQuizEvalMethods.length > 0 || !!data.preQuizEvalRules
    case 'lecture':
      return data.lectureSections.length > 0
    case 'inClassTasks':
      return data.inClassTasks.length > 0
    case 'inClassQuizzes':
      return data.inClassQuizEvalMethods.length > 0 || !!data.inClassQuizEvalRules
    case 'classQuestions':
      return data.classQuestions.length > 0
    case 'practiceTasks':
      return data.practiceTasks.length > 0
    case 'homeworks':
      return (
        data.homeworks.length > 0 || data.homeworkEvalMethods.length > 0 || !!data.homeworkEvalRules
      )
    case 'extensionMaterials':
      return data.extensionMaterials.length > 0
    case 'trainingReports':
      return data.trainingReports.length > 0
  }
}

function evalSummary(
  methods: string[],
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  return methods.length > 0 ? t('测评方式：{n}', { n: methods.map(methodLabel).join('、') }) : ''
}

export function getModuleSummary(
  key: AtomicModuleKey,
  data: NodeModuleData,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  switch (key) {
    case 'prePreview': {
      const lines = [truncate(data.previewContent)]
      if (data.previewAttachments.length > 0) {
        lines.push(t('{n} 份附件', { n: data.previewAttachments.length }))
      }
      return lines.filter(Boolean).join('\n')
    }
    case 'preResources':
      return listSummary(data.preClassResources, '份资源', t)
    case 'preTasks':
      return listSummary(data.preClassTasks, '项任务', t)
    case 'preQuizzes':
      return [
        evalSummary(data.preQuizEvalMethods, t),
        data.preQuizEvalRules ? t('已配置评价规则') : '',
      ]
        .filter(Boolean)
        .join('\n')
    case 'lecture':
      return listSummary(data.lectureSections, '个环节', t)
    case 'inClassTasks':
      return listSummary(data.inClassTasks, '项任务', t)
    case 'inClassQuizzes':
      return [
        evalSummary(data.inClassQuizEvalMethods, t),
        data.inClassQuizEvalRules ? t('已配置评价规则') : '',
      ]
        .filter(Boolean)
        .join('\n')
    case 'classQuestions':
      return listSummary(data.classQuestions, '个问题', t)
    case 'practiceTasks':
      return listSummary(data.practiceTasks, '项任务', t)
    case 'homeworks':
      return [
        data.homeworks.length > 0 ? t('{n} 项作业', { n: data.homeworks.length }) : '',
        evalSummary(data.homeworkEvalMethods, t),
        data.homeworkEvalRules ? t('已配置评价规则') : '',
      ]
        .filter(Boolean)
        .join('\n')
    case 'extensionMaterials':
      return listSummary(data.extensionMaterials, '份资料', t)
    case 'trainingReports':
      return listSummary(data.trainingReports, '份报告', t)
  }
}

// ==================== 预览卡片 ====================

export function ModulePreviewCard({
  moduleKey,
  data,
  onClick,
}: {
  moduleKey: AtomicModuleKey
  data: NodeModuleData
  onClick: () => void
}) {
  const t = useT()
  const meta = ATOMIC_MODULES_BY_KEY[moduleKey]
  const Icon = meta.icon
  const configured = isModuleConfigured(moduleKey, data)
  const summary = getModuleSummary(moduleKey, data, t)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full min-h-[128px] rounded-lg border p-3.5 text-left transition-all flex flex-col',
        configured
          ? 'bg-white border-gray-200 hover:border-primary hover:shadow-sm'
          : 'bg-gray-50/70 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'p-1.5 rounded-md shrink-0',
            configured ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium truncate flex-1">{t(meta.label)}</span>
        <Badge
          variant={configured ? 'secondary' : 'outline'}
          className="text-[10px] px-1.5 py-0 font-normal"
        >
          {configured ? t('已配置') : t('未配置')}
        </Badge>
      </div>
      <p
        className={cn(
          'text-xs leading-relaxed whitespace-pre-line line-clamp-4',
          configured ? 'text-gray-600' : 'text-gray-400',
        )}
      >
        {configured ? summary : t('尚未配置，点击卡片开始编辑')}
      </p>
    </button>
  )
}

// ==================== 编辑弹窗 ====================

export function ModuleEditDialog({
  nodeId,
  moduleKey,
  data,
  onChange,
  onRemove,
  onClose,
  courseId,
}: {
  nodeId: string
  moduleKey: AtomicModuleKey
  data: NodeModuleData
  onChange: (patch: Partial<NodeModuleData>) => void
  onRemove: () => void
  onClose: () => void
  courseId?: string
}) {
  const t = useT()
  const meta = ATOMIC_MODULES_BY_KEY[moduleKey]
  const Icon = meta.icon
  const Component = meta.component
  const mode = data.moduleModes?.[moduleKey] ?? 'online'

  const remove = () => {
    onRemove()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[820px] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded">
              <Icon className="h-4 w-4" />
            </div>
            {t(meta.label)}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <Component nodeId={nodeId} data={data} onChange={onChange} courseId={courseId} />
        </div>
        <DialogFooter className="flex items-center justify-between gap-2 border-t pt-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id={`module-edit-mode-${moduleKey}`}
                checked={mode === 'online'}
                onCheckedChange={(checked) =>
                  onChange({
                    moduleModes: {
                      ...data.moduleModes,
                      [moduleKey]: checked ? 'online' : 'offline',
                    },
                  })
                }
              />
              <Label
                htmlFor={`module-edit-mode-${moduleKey}`}
                className="text-xs text-gray-500 cursor-pointer"
              >
                {mode === 'online' ? t('线上') : t('线下')}
              </Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-red-500"
              onClick={remove}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('删除')}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('取消')}
            </Button>
            <Button onClick={onClose}>{t('完成')}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
